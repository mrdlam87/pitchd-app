---
description: Implement a GitHub issue by number. Creates a branch, implements the work, and opens a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Write, Grep, Glob, Agent
argument-hint: <issue-number>
---

You are implementing a GitHub issue for the Pitchd app.

## Step 1 — Fetch the issue
Run: `!gh issue view $ARGUMENTS --json number,title,body,labels,milestone`

Read the issue title, body, labels, and milestone carefully.

## Step 2 — Load context
Always read these before writing any code:
- `CLAUDE.md` — project overview, conventions, tech stack
- `docs/technical/technical-design.md` — architecture, data models, API routes, milestones

If the issue is UI-related, also check `prototypes/pitchd-light-v2.jsx` for the reference implementation and design patterns to match.

## Step 3 — Create a branch
Branch naming: `feature/`, `fix/`, or `chore/` prefix based on issue type, followed by issue number and a short slug.
Example: `feature/13-scaffold-nextjs-app`

Run: `!git checkout -b <branch-name>`

## Step 4 — Implement
Implement the issue following all conventions in CLAUDE.md:
- TypeScript throughout
- Tailwind utility classes only — no custom CSS
- Prisma for all DB interactions — no raw SQL
- Next.js App Router (not Pages Router)
- Prefer server components; use client components only when needed
- All API routes in `/app/api/`
- Environment variables in `.env.local`
- Claude Haiku for any AI features — never Sonnet or Opus
- All routes are protected — user must be authenticated

Keep the implementation focused on exactly what the issue describes. Do not add extra features or refactor unrelated code.

## Step 5 — Open a PR
Run: `!git add <relevant files> && git commit -m "<message>"`

Then create a PR:
```
gh pr create --title "<issue title>" --body "$(cat <<'EOF'
Closes #<issue-number>

## What
<1-3 bullet points describing what was implemented>

## Notes
<Any decisions made, trade-offs, or things to be aware of>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL when done.
