# `.claude/hooks` — CCR git fixes

These files are **not** part of the tidymaps application. They work around two
git defects in the Claude Code Remote container image, so that commits made by
Claude Code sessions on this repo are signed and correctly checked.

They live here because the defects are in files shipped inside Anthropic's base
image, which cannot be rebuilt from a session. A repo-committed `SessionStart`
hook is the only durable place to re-apply them: the container is ephemeral,
git is not.

| File | Role |
| --- | --- |
| `ccr-git-fixes.sh` | SessionStart hook; applies both fixes. Always exits 0. |
| `ccr-stop-hook-block.sh` | Corrected logic spliced into the container's Stop hook. Data, not run directly. |
| `../settings.json` | Registers the hook. |

## Defect 1 — commits landed unsigned

Signing config ships in `/home/claude/.gitconfig`, but git reads only
`$HOME/.gitconfig` and sessions run as root with `HOME=/root`, so that file is
never consulted. Provisioning does write `/root/.gitconfig` eventually, but it
can land well into a session — in the case that prompted this, about 48 minutes
in, after three commits had already been pushed.

An unset `commit.gpgsign` produces no error and no signature. Those commits are
permanently Unverified on GitHub: a signature is part of the commit object, so
re-signing changes the SHA, and rewriting merged history is not an option.

The fix asserts signing config at SessionStart, guarded on the signing helper
being executable — enabling `commit.gpgsign` without a working
`gpg.ssh.program` makes every `git commit` fail outright, which is worse.

## Defect 2 — the check that should have caught it

The container's `stop-hook-git-check.sh` blocks a turn ending with unpushed or
unverifiable commits. Three problems:

1. **Stale ref.** It diffs against `origin/$current_branch`, which goes stale
   once a PR merges and the branch is reset onto the default branch. Every
   just-merged commit then reads as local, including the merge commit authored
   by `noreply@github.com`. Its remediation would rewrite merged history.

2. **`%G?` is not a presence check.** It reads `%G? == N` as "unsigned", but
   `%G?` reports the result of *verifying* a signature. Verification is
   impossible in this image: `ssh-keygen` is absent and the signing helper
   supports only `-Y sign`. So `%G?` is `N` even for a well-formed signed
   commit, and amending cannot clear it — it re-signs, `%G?` is still `N`, and
   the hook blocks again until the CLI's block cap. A wedge, not just a false
   positive.

3. **Self-disabling gate.** The signature check ran only when
   `commit.gpgsign == true` — false during exactly the window in Defect 1 where
   signing is broken. The guard was switched off by the same condition that
   caused the problem.

The replacement reads signature presence from the raw commit header, treats "on
no origin ref" as the definition of unpushed, and gates on whether signing is
*expected* rather than currently enabled.

## Safety

Idempotent and guarded: it rewrites the Stop hook only when both known-buggy
markers are present, so a future upstream fix is skipped rather than clobbered.
Every failure path logs to stderr and exits 0.

## Removing this

If these fixes ship in the base image, delete `.claude/hooks/` and the
`SessionStart` block in `.claude/settings.json`. Nothing else depends on them.
