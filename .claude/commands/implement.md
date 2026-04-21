---
description: Implement a GitHub issue by number. Creates a branch, implements the work, verifies acceptance criteria, and opens a PR.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Write, Grep, Glob, Agent, TodoWrite, EnterPlanMode, ExitPlanMode
argument-hint: <issue-number>
---

You are a **software architect** implementing a GitHub issue for the Pitchd app. Spend the first third of your effort reading and planning — do not write code until you have a clear picture of what exists and what needs to change.

## Step 1 — Fetch the issue
Run: `!gh issue view $ARGUMENTS --json number,title,body,labels,milestone`

Read the issue title, body, labels, milestone, and **acceptance criteria** carefully. The acceptance criteria are the definition of done — every item must be met before the PR is raised.

## Step 2 — Load context
Always read these before writing any code:
- `CLAUDE.md` — project overview, conventions, tech stack
- `docs/technical/technical-design.md` — architecture, data models, API routes, milestones

If the issue is UI-related, also check `prototypes/pitchd-light-v2.jsx` for the reference implementation and design patterns to match.

## Step 3 — Assess complexity
Classify the issue before doing anything else:

| Tier | Criteria |
|---|---|
| **Simple** | 1–2 files, clear scope, no DB/auth/concurrency changes |
| **Medium** | 3–5 files, moderate scope, touches DB schema or API routes |
| **Complex** | 6+ files, architectural impact, concurrency/transactions/auth |

State the tier and what it means for this task. Complex issues get extra adversarial review attention in Step 9.

**Checkpoint:** State the tier and a one-line reason before proceeding.

## Step 4 — Enter plan mode and explore

**Enter plan mode now** using the `EnterPlanMode` tool. Remain in plan mode until the plan is confirmed.

Use Grep and Glob to find every file relevant to the issue — existing routes, models, components, scripts, migrations, or utilities that the implementation will touch or depend on.

**Rule: never assume code exists.** Grep to confirm every function, method, field, model, or constant you plan to reference actually exists before using it. Hallucinated references are a top source of bugs.

Read any files you'll be modifying.

Then present a plan to the user:

---
### Plan
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Create / Edit / Delete | `path/to/file` | What and why |

**Risks / unknowns:** anything ambiguous, potentially breaking, or worth flagging upfront.

---

Ask: **"Does this look right? I'll create the branch and start once you confirm."**

Wait for confirmation before proceeding.

**Checkpoint:** Plan table presented and confirmed by the user.

## Step 5 — Exit plan mode and write context file

After the user confirms the plan:

1. **Exit plan mode** using the `ExitPlanMode` tool.
2. Write a context file at `.claude/context/issue-$ARGUMENTS.md` (create the directory if it doesn't exist).

The context file must be a rich, specific document — not a template with placeholder text. Write it as if briefing a colleague who is picking up the work mid-session. Every section should contain real findings from your exploration, not generic descriptions.

```markdown
# Plan: Issue #<number> — <title>

## Context
<A narrative paragraph explaining the current state of the codebase relevant to this issue: what exists, what has grown or changed, why the work is needed, and any constraints or background the implementation must account for. Be specific — reference file names, line counts, function names, or prior milestones if relevant.>

## Complexity
<Simple / Medium / Complex> — <one-line reason>

## What to build / change

### 1. `<file path>`
- <Specific detail: what functions/types/components move here, what line ranges they come from, what imports are needed, what the component/hook receives and returns>
- <Continue with all specific detail discovered during exploration>

### 2. `<file path>`
- <Same level of specificity>

<One section per file in the plan. For edits, describe exactly what is removed, added, or restructured.>

## Files
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Create / Edit / Delete | `path/to/file` | What and why |

## Risks / unknowns
- <Specific risk referencing actual code behaviour, edge cases, or invariants that must be preserved — not generic concerns>

## Verification
- <Exact commands to run (lint, build, test)>
- <Manual steps: what to click, what to observe, what must not regress>

## Status
- [ ] Branch created
- [ ] Implementation complete
- [ ] Acceptance criteria verified
- [ ] Build & lint passing
- [ ] PR raised
```

## Step 6 — Create a branch
Branch naming: `feature/`, `fix/`, or `chore/` prefix based on issue type, followed by issue number and a short slug.
Example: `feature/13-scaffold-nextjs-app`

Run: `!git checkout -b <branch-name>`

Update the context file: tick `- [x] Branch created`.

## Step 7 — Implement
For Medium or Complex issues, use `TodoWrite` to track progress — one task per file or logical unit of work. Mark each done as you go.

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

**Checkpoint:** All planned files created or modified. TodoWrite tasks marked done.

Update the context file: tick `- [x] Implementation complete`.

## Step 8 — Verify acceptance criteria
Go through each acceptance criteria item from the issue body one by one. For each item:
1. Verify it is met by reading the relevant code, running a check, or confirming the behaviour
2. If an item is not met, fix it before proceeding
3. Once verified, tick it off on the GitHub issue — replace `- [ ]` with `- [x]` for that item

Update the issue body:
```
gh issue edit $ARGUMENTS --repo mrdlam87/pitchd-app --body "<full updated body with ticked checkboxes>"
```

Do not raise the PR until all acceptance criteria are ticked.

Update the context file: tick `- [x] Acceptance criteria verified`.

## Step 9 — Build & smoke test
Run these checks before opening the PR. Fix any errors before proceeding.

**Always run:**
```bash
cd app && npm run lint
cd app && npm run build
```

**If `prisma/schema.prisma` or `prisma/migrations/` were changed:**
```bash
cd app && npx prisma format
cd app && npx prisma generate
cd app && npx prisma migrate status
```

**If the issue adds or modifies an API route:**
- Write or update tests in `tests/api/<route>.test.ts` covering the new/changed behaviour before opening the PR
- Use the API route checklist from Step 10 to drive test cases — every validation rule should have a corresponding test
```bash
cd app && npm test
```
All tests must pass before opening the PR.

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

Update the context file: tick `- [x] Build & lint passing`.

## Step 10 — Pre-PR self-review
Re-read every file you changed. Answer each question below out loud before marking it done. Fix anything you find.

**Adversarial questions:**
- What happens if this runs twice concurrently?
- What if any of these fields are null, zero, empty string, or negative?
- What assumptions am I making that could be wrong in production?
- If I were trying to break this, how would I do it?

**Named patterns to check for:**
- **TOCTOU** — if you read state and then act on it without an atomic lock, that's a race condition. Any read-then-write on shared DB rows or files needs an atomic check-and-act.
- **Transaction side-effects** — records created inside a DB transaction are rolled back if the transaction throws. Error logs, audit records, and notifications must be written *outside* the transaction.

**Lifecycle checklist:**
- [ ] Edge cases & failure modes covered
- [ ] Operational concerns addressed (timeouts, concurrency, failure notifications for scheduled jobs)
- [ ] Data integrity — full lifecycle handled (insert, update, *and* stale/removed records)
- [ ] Resource cleanup — DB connections and file handles closed on error paths (`.finally(() => prisma.$disconnect())`)
- [ ] Scope matches intent of the issue, not just its literal acceptance criteria

For **Complex** issues, spend extra time on the adversarial questions and TOCTOU/transaction checks.

**If the issue is an API route, also check:**
- [ ] All query params validated: missing (null), empty string, non-numeric, and out-of-range values
- [ ] Use `Number()` not `parseFloat()` — `parseFloat("123abc")` silently returns `123`; `Number("123abc")` returns `NaN`. Use `|| NaN` to handle null/empty: `Number(param || NaN)`
- [ ] `try/catch` wraps all DB calls; catch block logs with `console.error` before returning 500
- [ ] `orderBy` includes a unique tiebreaker (e.g. `{ id: "asc" }`) for stable pagination across pages
- [ ] Columns used in `where` filters have indexes in `schema.prisma`
- [ ] Paginated responses include metadata: `page`, `pageSize`, `hasMore`
- [ ] Array params use `.filter(Boolean)` to drop empty string values (e.g. `?amenities=`)
- [ ] Return type annotation on the handler: `Promise<Response>`

Do not open the PR until all items are addressed.

## Step 11 — Open a PR
Commit using conventional commit format:
```
git commit -m "type(scope): short description"
```
Types: `feat`, `fix`, `chore`, `refactor`, `docs`. Scope is optional but useful (e.g. `feat(auth)`, `fix(osm-sync)`).

Stage only files relevant to the issue — do not use `git add -A`.

Then create a PR:
```
gh pr create --base main --title "<issue title>" --body "$(cat <<'EOF'
Closes #<issue-number>

## What
<1-3 bullet points describing what was implemented>

## Self-review
- [x] Adversarial questions answered (concurrency, nulls, assumptions, break attempts)
- [x] TOCTOU and transaction side-effects checked
- [x] Data integrity — full lifecycle handled
- [x] Resource cleanup — connections/handles closed on error paths
- [x] Scope matches intent of the issue

## Notes
<Any decisions made, trade-offs, or things the reviewer should know>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Update the context file: tick `- [x] PR raised` and add the PR URL at the bottom.

Return the PR URL.
