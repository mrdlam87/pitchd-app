---
description: Review open PR comments and present a table of issues with recommended actions, then wait for approval before implementing.
allowed-tools: Bash(git:*), Bash(gh:*), Read, Edit, Write, Grep, Glob
---

You are addressing open review comments on the current pull request.

## Step 1 — Get the PR number for the current branch
Run: `!git branch --show-current`
Then find the PR: `!gh pr view --json number,title,url`

## Step 2 — Fetch all review comments
Use the actual repo from: `!gh repo view --json nameWithOwner --jq '.nameWithOwner'`
And PR number from step 1.

PR-level comments (where Claude posts summaries): `!gh api repos/{owner}/{repo}/issues/{pr_number}/comments --jq '.[] | {author: .user.login, body: .body}'`
Inline code comments: `!gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --jq '.[] | {path: .path, line: .line, body: .body, author: .user.login}'`
Formal reviews: `!gh pr view --json reviews --jq '.reviews[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED") | {author: .author.login, body: .body}'`

## Step 3 — Present a review table
Do NOT make any changes yet. Instead, analyse all comments and present a table:

| # | File | Issue | Recommended Action | Priority |
|---|---|---|---|---|
| 1 | path/to/file.ts | Description of issue | What you plan to do | High / Medium / Low |

Below the table, note any comments you plan to skip and why (e.g. question only, already resolved, out of scope).

Then ask: **"Shall I go ahead and implement all of these?"**

## Step 4 — Implement (only after user confirms)
Once the user confirms, address each item in the table:
1. Read the referenced file and line
2. Make the change
3. If a comment is a question or FYI (not requesting a code change), skip it

## Step 5 — Commit and push
Stage and commit the fixes:
```
git add <changed files>
git commit -m "fix: address PR review comments"
git push
```

Summarise what was changed and what was skipped.
