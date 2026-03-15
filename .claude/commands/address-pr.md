---
description: Address all open PR review comments on the current branch
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

## Step 3 — Analyse and address each comment
For each comment:
1. Read the referenced file and line if applicable
2. Understand what change is being requested
3. Make the change
4. If a comment is a question or FYI (not requesting a code change), skip it

## Step 4 — Summarise
After addressing all comments, list:
- What was changed and why
- Any comments you skipped and why (e.g. question, already resolved, out of scope)
