#!/usr/bin/env bash
# SessionStart hook: repair two git defects in the Claude Code Remote (CCR)
# container image. See .claude/hooks/README.md for the full write-up.
#
# Both defects live in files shipped inside Anthropic's CCR base image
# (ANT_IMAGE_REPOSITORY=sandbox-ccr-default), which cannot be rebuilt from a
# session. This hook re-applies the fixes at the start of every session so they
# survive container reclamation.
#
# Always exits 0: a broken repair must never wedge session startup.

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCR_STOP_HOOK="${CCR_GIT_FIXES_STOP_HOOK:-/root/.claude/stop-hook-git-check.sh}"
IMAGE_GITCONFIG="${CCR_GIT_FIXES_IMAGE_GITCONFIG:-/home/claude/.gitconfig}"
MARKER="ccr-git-fixes: patched"

log() { echo "ccr-git-fixes: $*" >&2; }

# ---------------------------------------------------------------------------
# Fix 1 — assert commit signing config early.
#
# The signing config ships in /home/claude/.gitconfig, but git reads only
# $HOME/.gitconfig and CCR sessions run as root with HOME=/root, so the image
# file is never consulted. Provisioning does eventually write /root/.gitconfig,
# but that can land well into a session -- observed ~48 minutes in, after three
# commits had already been made and pushed. An unset commit.gpgsign produces no
# error and no signature, so those commits land unsigned and GitHub shows them
# Unverified permanently: signatures are part of the commit object, so
# re-signing changes the SHAs, and rewriting pushed history is not an option.
#
# Only enable signing when the helper is actually executable. commit.gpgsign=true
# with a missing gpg.ssh.program makes every `git commit` fail outright, which is
# a worse failure than an unsigned commit.
# ---------------------------------------------------------------------------
apply_signing_config() {
  [[ -r "$IMAGE_GITCONFIG" ]] || return 0

  local prog fmt key
  prog=$(git config --file "$IMAGE_GITCONFIG" --get gpg.ssh.program 2>/dev/null)
  fmt=$(git config --file "$IMAGE_GITCONFIG" --get gpg.format 2>/dev/null)
  key=$(git config --file "$IMAGE_GITCONFIG" --get user.signingkey 2>/dev/null)

  if [[ -z "$prog" || ! -x "$prog" ]]; then
    log "signing helper unavailable (${prog:-unset}); leaving commit.gpgsign alone"
    return 0
  fi

  [[ -n "$fmt" ]] && git config --global gpg.format "$fmt" 2>/dev/null
  [[ -n "$key" ]] && git config --global user.signingkey "$key" 2>/dev/null
  git config --global gpg.ssh.program "$prog" 2>/dev/null
  git config --global commit.gpgsign true 2>/dev/null

  # Identity must match the address CCR's signing key is registered to, or
  # GitHub reports unknown_key and shows the commit Unverified anyway.
  git config --global user.email noreply@anthropic.com 2>/dev/null
  git config --global user.name Claude 2>/dev/null
}

# ---------------------------------------------------------------------------
# Fix 2 — repair the CCR Stop hook's unpushed/signature checks.
#
# Two defects in the stock version:
#
#   a) It diffs against origin/$current_branch. That ref goes stale the moment a
#      PR merges and the branch is reset onto the default branch, so every
#      just-merged commit reads as local -- including GitHub's own merge commit,
#      which is authored by noreply@github.com and therefore also fails the
#      signature test. Following its advice would rewrite merged history.
#
#   b) It treats `%G? == N` as "unsigned". %G? reports the result of *verifying*
#      a signature, and verification is structurally impossible in this image:
#      ssh-keygen is absent and the signing helper reports "currently only
#      SSH-style signing (-Y sign) is supported". So %G? is N even for a
#      well-formed signed commit, and the hook's own remediation cannot clear it
#      -- amending re-signs, %G? is still N, and it blocks again until the CLI's
#      global block cap. That is a wedge, not just a false positive.
#
# The replacement reads signature presence from the raw commit header and treats
# "on no origin ref" as the definition of unpushed.
#
# Guarded and idempotent: patches only when the known-buggy markers are present,
# so a future upstream fix is left untouched rather than clobbered.
# ---------------------------------------------------------------------------
patch_ccr_stop_hook() {
  [[ -f "$CCR_STOP_HOOK" && -w "$CCR_STOP_HOOK" ]] || return 0
  [[ -r "$HOOK_DIR/ccr-stop-hook-block.sh" ]] || { log "corrected block missing; skipping"; return 0; }

  python3 - "$CCR_STOP_HOOK" "$HOOK_DIR/ccr-stop-hook-block.sh" "$MARKER" <<'PY'
import sys

target, block_path, marker = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    src = open(target, encoding="utf-8").read()
except OSError as e:
    print("ccr-git-fixes: cannot read stop hook: %s" % type(e).__name__, file=sys.stderr)
    raise SystemExit(0)

if marker in src:
    raise SystemExit(0)  # already patched this container

anchor = "current_branch=$(git branch --show-current)"
if anchor not in src:
    print("ccr-git-fixes: anchor absent; upstream changed, leaving as-is", file=sys.stderr)
    raise SystemExit(0)

head, _, tail = src.partition(anchor)

# Only touch a version that actually carries both defects. If either marker is
# gone, assume upstream fixed it and do nothing rather than risk a regression.
buggy = ('upstream="origin/$current_branch"' in tail) and ("%G?" in tail)
if not buggy:
    print("ccr-git-fixes: stop hook no longer matches known-buggy shape; skipping",
          file=sys.stderr)
    raise SystemExit(0)

try:
    block = open(block_path, encoding="utf-8").read().rstrip("\n")
except OSError as e:
    print("ccr-git-fixes: cannot read block: %s" % type(e).__name__, file=sys.stderr)
    raise SystemExit(0)

new = "%s# %s\n%s\n\nexit 0\n" % (head, marker, block)

try:
    with open(target, "w", encoding="utf-8") as f:
        f.write(new)
except OSError as e:
    print("ccr-git-fixes: cannot write stop hook: %s" % type(e).__name__, file=sys.stderr)
    raise SystemExit(0)

print("ccr-git-fixes: stop hook patched", file=sys.stderr)
PY
}

apply_signing_config
patch_ccr_stop_hook

exit 0
