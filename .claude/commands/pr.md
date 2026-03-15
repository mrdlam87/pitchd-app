---
description: Commit current changes and create a PR. Stages files, commits, pushes branch, and opens a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob
---

You are committing the current changes and creating a pull request for the Pitchd app.

## Step 1 — Review current changes
Run: `!git status`
Run: `!git diff --stat`

Identify what files have changed and understand what the changes are about.

## Step 2 — Check current branch
Run: `!git branch --show-current`

If on `main`, stop and tell the user to switch to a feature branch first. Do not commit directly to main.

## Step 3 — Stage and commit
Stage relevant files (never stage .env, .env.local, or secrets):
`!git add <files>`

Write a concise commit message that describes what changed and why. Use the format:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for config, docs, tooling

```
git commit -m "$(cat <<'EOF'
<type>: <short description>

<optional longer explanation if needed>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 4 — Push branch
`!git push -u origin <branch-name>`

## Step 5 — Create PR
```
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points of what changed>

## Notes
<any decisions, trade-offs, or things to be aware of — omit if none>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL when done.
