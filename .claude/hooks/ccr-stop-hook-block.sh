current_branch=$(git branch --show-current)
if [[ -n "$current_branch" ]]; then
  # "Unpushed" means present on no origin ref at all. Diffing against
  # origin/$current_branch alone misfires under the merge-and-restart workflow:
  # after a PR merges, the branch is reset onto origin/<default> while the
  # remote feature ref still points at the pre-merge tip, so every commit that
  # was just merged looks local again — including GitHub's own merge commit,
  # which is authored by noreply@github.com and so also trips the signature
  # check below. Amending those would rewrite already-merged history.
  #
  # Bail if nothing has been fetched from origin yet: every commit would look
  # unpushed and both checks would be pure noise.
  if [[ -z "$(git for-each-ref --count=1 refs/remotes/origin 2>/dev/null)" ]]; then
    exit 0
  fi

  local_only=$(git rev-list HEAD --not --remotes=origin 2>/dev/null)

  if [[ -n "$local_only" ]]; then
    # Rebase base = parent of the oldest commit not yet on any origin ref.
    rebase_base="$(echo "$local_only" | tail -1)^"

    # Check for local commits that GitHub will show as "Unverified": either no
    # signature at all, or signed with a committer email other than
    # noreply@anthropic.com (the identity CCR's signing key is registered to).
    # Runs whenever signing is *expected*, which is not the same as whether it
    # is currently switched on. Gating on the effective commit.gpgsign alone
    # disables this check in exactly the window where it is needed: git reads
    # only $HOME/.gitconfig, CCR runs as root with HOME=/root, and until
    # provisioning copies the base image's /home/claude/.gitconfig across,
    # commit.gpgsign reads false. Commits made in that window are silently
    # unsigned AND unchecked — which is how three of them reached origin.
    # Treat the image config as a declaration of intent so the gap is covered.
    #
    # Signature presence is read from the raw commit header, NOT from %G?.
    # %G? reports the result of *verifying* the signature, and with
    # gpg.format=ssh and no gpg.ssh.allowedSignersFile — the CCR default —
    # git cannot verify at all and reports N for a perfectly well-formed
    # signed commit. Gating on %G? == N therefore flags every signed commit,
    # and the remediation below cannot clear it: amending re-signs, git still
    # reports N, and the hook blocks again until the CLI's global block cap.
    # The header is the only local source of truth for presence.
    signing_expected=false
    if [[ "$(git config --type=bool commit.gpgsign 2>/dev/null)" == "true" ]]; then
      signing_expected=true
    elif [[ -r /home/claude/.gitconfig ]] && [[ "$(git config --file /home/claude/.gitconfig --type=bool --get commit.gpgsign 2>/dev/null)" == "true" ]]; then
      signing_expected=true
    fi

    if [[ "$signing_expected" == "true" ]]; then
      unverifiable=""
      while read -r sha email; do
        [[ -z "$sha" ]] && continue
        # Headers only: stop at the blank line so a message body that happens
        # to contain a "gpgsig..." line cannot pass as a signature.
        if ! git cat-file commit "$sha" 2>/dev/null | sed -n '/^$/q;p' | grep -q '^gpgsig'; then
          unverifiable+="${sha:0:8} unsigned $email"$'\n'
        elif [[ "$email" != "noreply@anthropic.com" ]]; then
          unverifiable+="${sha:0:8} committer-email $email"$'\n'
        fi
      done < <(git log --format='%H %ce' HEAD --not --remotes=origin 2>/dev/null)
      unverifiable="${unverifiable%$'\n'}"
      if [[ -n "$unverifiable" ]]; then
        echo "There are commit(s) on branch '$current_branch' that GitHub will show as Unverified (missing signature, or committer email is not noreply@anthropic.com):" >&2
        echo "$unverifiable" >&2
        echo "Please run 'git config user.email noreply@anthropic.com && git config user.name Claude', then 'git commit --amend --no-edit --reset-author' for the tip commit, or 'git rebase --exec \"git commit --amend --no-edit --reset-author\" $rebase_base' for earlier commits, then push." >&2
        exit 2
      fi
    fi

    unpushed=$(echo "$local_only" | wc -l)
    if git rev-parse --verify --quiet "origin/$current_branch" >/dev/null 2>&1; then
      echo "There are $unpushed unpushed commit(s) on branch '$current_branch'. Please push these changes to the remote repository." >&2
    else
      echo "Branch '$current_branch' has $unpushed unpushed commit(s) and no remote branch. Please push these changes to the remote repository." >&2
    fi
    exit 2
  fi
fi
