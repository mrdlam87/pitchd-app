---
description: End-of-session wrap-up. Updates docs with decisions made, closes completed issues, commits and raises a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Write, Grep, Glob
---

You are wrapping up a Claude Code session for the Pitchd app. Your job is to make sure all context is captured and ready for the next session.

## Step 1 — Review what happened this session
Run: `!git log --oneline -20`
Run: `!gh issue list --state closed --limit 20 --json number,title,closedAt | jq '.[] | select(.closedAt > (now - 86400 | todate))'` to find issues closed today.

Also review the current conversation to identify:
- Technical decisions made
- Features implemented
- Anything that changed from the plan

## Step 2 — Update docs/project-context.md
- Update **Current Phase** if the phase has changed
- Add a new row to the **Session Log** table with today's date, current phase, and a concise summary of what was covered
- Update **Next Actions** with what should be tackled next session
- Mark any completed phases with ✅

## Step 3 — Update docs/technical/technical-design.md
Only update if technical decisions were made this session:
- New or changed architecture decisions
- Data model changes
- API route changes
- New milestones or milestone changes
- Any TBD sections that are now resolved

## Step 4 — Update CLAUDE.md
Only update if something fundamental changed:
- Current stage / phase
- Tech stack decisions finalised
- Milestone progress

## Step 5 — Close completed GitHub issues
For any work completed this session that has a corresponding GitHub issue, close it:
`!gh issue close <number> --comment "Completed in this session."`

## Step 6 — Commit and raise a PR
Stage only doc files (never commit .env or secrets):
```
git add CLAUDE.md docs/ .claude/commands/
git checkout -b chore/session-wrap-<YYYY-MM-DD>
git commit -m "chore: session wrap-up <YYYY-MM-DD>"
git push -u origin chore/session-wrap-<YYYY-MM-DD>
```

Then create a PR:
```
gh pr create --title "Session wrap-up <YYYY-MM-DD>" --body "$(cat <<'EOF'
## Session summary
<bullet points of what was covered>

## Docs updated
<list of files changed and why>

## Issues closed
<list of issues closed, or "none">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL when done.
