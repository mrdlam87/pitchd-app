---
description: Review and refine a GitHub issue's acceptance criteria and plan the implementation before building. Run this before /implement.
allowed-tools: Bash(gh:*), Read, Glob, Grep
argument-hint: <issue-number>
---

You are planning the implementation of a GitHub issue for the Pitchd app. Do NOT write any code yet.

## Step 1 — Fetch the issue
Run: `!gh issue view $ARGUMENTS --json number,title,body,labels,milestone`

Read the issue title, body, labels, milestone, and existing acceptance criteria carefully.

## Step 2 — Load context
Always read these before planning:
- `CLAUDE.md` — project overview, conventions, tech stack
- `docs/technical/technical-design.md` — architecture, data models, API routes, milestones

If the issue is UI-related, also check `prototypes/pitchd-light-v2.jsx` for the reference implementation.

If the issue touches existing code, use Glob and Grep to find relevant files before planning.

## Step 3 — Review acceptance criteria
Evaluate the existing acceptance criteria and identify:
- Any items that are missing or incomplete
- Any items that are too vague to verify
- Any items that are out of scope for this issue
- Any items that depend on another issue not yet done

## Step 4 — Draft implementation plan
Outline exactly how you would implement this issue:
- What files will be created
- What files will be modified
- Key decisions or trade-offs to be aware of
- Any blockers or dependencies on other issues
- Estimated complexity (simple / moderate / complex)

## Step 5 — Present for review
Present everything to the user in this format:

---

### Refined Acceptance Criteria
Show the full updated checklist — unchanged items plus any additions, removals, or clarifications. Clearly mark changes with **(new)**, **(updated)**, or **(removed)**.

### Implementation Plan
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Create / Edit / Delete | `path/to/file` | What and why |

### Decisions needed
List any ambiguous points that need the user's input before implementation starts.

### Blockers
List any other issues that must be completed first, or none.

---

Then ask: **"Shall I update the issue with these refined acceptance criteria?"**

## Step 6 — Update the issue (only after user confirms)
If the user confirms, update the issue body with the refined acceptance criteria:
```
gh issue edit $ARGUMENTS --repo mrdlam87/pitchd-app --body "<full updated body>"
```

Confirm the issue has been updated and that it's ready for `/implement`.
