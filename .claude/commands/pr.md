---
description: Commit current changes and create a PR. Stages files, commits, pushes branch, and opens a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob
---

You are committing the current changes and creating a pull request for the Pitchd app.

## Step 1 — Review current changes
Run: `!git status`
Run: `!git diff --stat`

Read the changed files to understand what was done and why. Use this to inform the branch
name, commit message, and PR description — all should reflect the actual intent of the changes,
not just the file names.

## Step 2 — Check current branch
Run: `!git branch --show-current`

If on `main`, create a new branch before doing anything else. Derive a short, descriptive
branch name from the changes using the appropriate prefix:
- `fix/` for bug fixes
- `feat/` for new features
- `chore/` for config, tooling, docs

```
git checkout -b <prefix>/<short-description>
```

## Step 3 — Stage and commit
Use your session context to identify which files you modified this session. Never include
.env, .env.local, or secrets.

Present the user with two lists:
- **Staging (modified this session):** files you will stage
- **Skipping (not touched this session):** other dirty files you will leave unstaged

Ask the user to confirm or adjust before staging anything. Only proceed once confirmed.

`!git add <files>`

Write a concise commit message that describes what changed and why. Use the format:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for config, docs, tooling

```
git commit -m "$(cat <<'EOF'
<type>: <short description>

<optional body explaining the problem and approach if non-obvious>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 4 — Push branch
`!git push -u origin <branch-name>`

## Step 5 — Create PR
Write a PR title and description that gives a reviewer full context: what the problem was,
what the fix is, and any trade-offs or follow-up actions needed.

```
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points of what changed and why>

## Notes
<decisions, trade-offs, follow-up actions, or things to be aware of — omit section if none>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL when done.
