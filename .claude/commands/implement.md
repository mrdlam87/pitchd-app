---
description: Implement a GitHub issue by number. Creates a branch, implements the work, verifies acceptance criteria, and opens a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Write, Grep, Glob, Agent
argument-hint: <issue-number>
---

You are implementing a GitHub issue for the Pitchd app.

## Step 1 — Fetch the issue
Run: `!gh issue view $ARGUMENTS --json number,title,body,labels,milestone`

Read the issue title, body, labels, milestone, and **acceptance criteria** carefully. The acceptance criteria are the definition of done — every item must be met before the PR is raised.

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

## Step 5 — Verify acceptance criteria
Go through each acceptance criteria item from the issue body one by one. For each item:
1. Verify it is met by reading the relevant code, running a check, or confirming the behaviour
2. If an item is not met, fix it before proceeding
3. Once verified, tick it off on the GitHub issue by updating the issue body — replace `- [ ]` with `- [x]` for that item

Update the issue body with all ticked items:
```
gh issue edit $ARGUMENTS --repo mrdlam87/pitchd-app --body "<full updated body with ticked checkboxes>"
```

Do not raise the PR until all acceptance criteria are ticked.

## Step 6 — Build & smoke test
Run these checks before opening the PR. Fix any errors before proceeding.

**Always run:**
```bash
cd app && npm run lint
cd app && npm run build
```

**If `prisma/schema.prisma` or `prisma/migrations/` were changed:**
```bash
cd app && npx prisma generate
cd app && npx prisma migrate status
```

**Issue-type smoke tests** — run the most relevant check(s) for the issue:
| Issue type | Manual check |
|---|---|
| Auth / protected routes | Start dev server, visit a protected route unauthenticated — confirm redirect |
| API route | `curl` or browser fetch the endpoint with a valid session |
| DB schema / migration | Check Supabase dashboard — confirm tables/columns match schema |
| UI component | Start dev server, visually verify the component renders correctly |
| Data pipeline / seed | Query the DB — confirm expected rows exist |
| AI / search | Trigger a sample query end-to-end and inspect the response |

Report the results of each check. If a check fails, fix it before proceeding.

## Step 7 — Open a PR
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
