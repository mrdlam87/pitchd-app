# Harness Workflow — How v2 Is Built with Claude Code

> First item on the pre-code checklist in `open-questions.md`. This is about the **Claude Code development workflow** for `pitchd-v2`: how the code gets written, checked and reviewed. It is *not* about the Pitchd agent's own harness (its tool loop and prompts), which is covered in `architecture.md`.
> **Applies to the new `pitchd-v2` repo** (decision D) — nothing here changes `pitchd-app`, whose `.claude/` setup and workflows stay as they are while v1 is frozen. This doc moves to `pitchd-v2/docs/` with the rest of `docs/revamp/`.
> Status: **all decisions made (H1–H9), 2026-11-10.** Each is recorded here and in `decisions.md`. Next: build it in `pitchd-v2` following H9.

## What carries over from v1 (`pitchd-app`)

| Piece | v1 today | Keep? |
|---|---|---|
| `CLAUDE.md` | One 176-line root file; Next.js + Prisma conventions, prototype tokens, "Haiku only" | Rewrite for v2 (H1) |
| Commands | `/plan`, `/implement`, `/pr`, `/address-pr`, `/wrap-up` in `.claude/commands/` | Update (H3) |
| Subagents | `senior-engineer` (TS/Next.js, Sonnet, project memory), `ux-designer` (v1 drawer/filter patterns) | Update (H4) |
| Agent memory | `.claude/agent-memory/<agent>/` — v1-specific notes | Decide in H4 |
| Settings | `.claude/settings.json` turns on the Figma plugin only; no hooks, no permission rules | New (H5, H6) |
| CI | `ci.yml` (lint, Prisma checks, build, integration tests on Postgres 16); `claude-code-review.yml` (review on every PR, `[blocking]` / `[suggestion]` inline comments); `claude.yml` (`@claude` mentions) | Update (H7) |
| Habits | "Before writing code" checklist, pre-PR self-review, adversarial questions in `/implement`, issue context files in `.claude/context/` | Keep (reworded for Python + TS) |

## Rules from earlier decisions that must land in v2's `CLAUDE.md`

These are already decided (see `decisions.md`). H1 decides *where* each one goes.

- **Q12 — data layer:** Python owns the schema (SQLAlchemy 2.0 + Alembic, PostGIS via GeoAlchemy2); `web/` has no database access and no ORM; TS types are generated from FastAPI's OpenAPI spec (`openapi-typescript`). Every migration is reviewed and committed with the code that needs it. **Supabase gotchas:** Data API off (or RLS on with no policies on every table) so the anon key reads nothing; the app connects through the Supavisor pooler in transaction mode with `prepare_threshold=None`; Alembic uses the direct connection.
- **Q11 — hosting & auth:** Cloud Run `australia-southeast1`; Supabase `ap-southeast-2`; Vercel functions `syd1`. No work after the response; anything slow or deferred goes to a Cloud Run Job. Agent events are stored in Postgres with IDs (resumable streams). Browser streams directly from the service with a ~10-minute signed token minted by a Next.js route (user ID + role), verified with a public key; CORS limited to the web origin. Secrets in Secret Manager; deploys via GitHub Actions with Workload Identity Federation (no stored keys). Plain `Dockerfile`, config in environment variables.
- **Q17 — cost caps:** target ≤ US$0.30 per trip (median); hard cap US$1.50 per conversation, tracked from each response's `usage`; near the cap, stop calling tools and answer with what it has (never a cut-off answer); per-user caps from stage 2; log cost per trip, turn and tool from day one.
- **Q13 — model switching:** model + effort per job in config, logged on every turn; never turn thinking off; always set effort explicitly; never force a tool call (use structured outputs + strict tool schemas); one refusal handler, always check `stop_reason` before reading content; cap context per job; pass history back unchanged, including thinking blocks; model upgrades = migration notes → config → evals → fix regressions. Replaces v1's "Haiku for all AI features".
- **Also from earlier decisions:** site IDs only from tool results, validated server-side; scoring and thresholds in code with tests, not in prompts; fetched pages and user text are untrusted data; data agent proposes, never overwrites; source allowlist in code; semantic colour tokens (light + dark), coral = Pitchd only, 13 px text floor; AU English, metric units.

## Decisions

| # | Topic | Status |
|---|---|---|
| H1 | `CLAUDE.md` layout — one file or split per folder | **Decided:** short root + `agent/` and `web/` files |
| H2 | Where sessions run + work tracking — issues, plans, how a piece of work flows | **Decided:** local-first via Remote Control; milestones per phase; plan files in `planning/` (amended by H3) |
| H3 | Skills / commands — the build flow | **Decided:** one resumable `/harness` skill; subagents do the heavy work; `/decide` + `/eval` separate; built-in + focused Superpowers skills inside the steps (H3b) |
| H4 | Subagents — `senior-engineer`, `ux-designer`, any new ones; agent memory | **Decided:** built-in Explore + five role agents + both advisers rewritten |
| H5 | Hooks — format / lint / test for Python + TS, guard rails | **Decided:** format + lint-fix per edit, guard rails, session-start status; no test hooks; lefthook pre-commit |
| H6 | Permissions — allow / ask / deny rules | **Decided:** committed allow / ask / deny lists; auto mode for `/harness` runs |
| H7 | CI — checks and Claude review on PRs | **Decided:** agent / web / contract checks required; Claude review once per PR, then on request |
| H8 | Tool tests and eval runs — where they fit | **Decided:** four tiers — tool tests + fake-model loop tests every PR; smoke eval for `evals` work; full eval before model/prompt changes merge |
| H9 | Setup order — what gets created in `pitchd-v2` before the first line of code | **Decided:** core harness by hand, dry-run issue, `/eval` at P1, deploys at P3 |

<!-- Decisions are filled in below as they're made. -->

### H1 — `CLAUDE.md` layout: short root + one file per folder (decided 2026-11-10)
- **Decision (option B, with D's way out):** three files. Claude Code always loads the root file and loads a folder's file only when it works in that folder, so each session gets just the rules for the code it's touching.
  | File | Gets |
  |---|---|
  | Root `CLAUDE.md` | What Pitchd v2 is, repo map, key docs, branch/PR workflow, "before writing code" + pre-PR self-review; rules for both stacks: Q17 cost caps as a principle, site IDs only from tool results, untrusted input, scoring and thresholds in code, AU English + metric |
  | `agent/CLAUDE.md` | Python style and tests; Q12 (SQLAlchemy 2.0 + Alembic, PostGIS, Supabase gotchas); Q11 (Cloud Run, no work after the response, Jobs, resumable events, token check); Q13 model-switching rules; Q17 cap implementation; data-agent rules (propose, don't overwrite; source allowlist) |
  | `web/CLAUDE.md` | Thin client (no DB, no ORM); generated OpenAPI types; Auth.js + token-minting route; `syd1`; B1–B7 visual rules (semantic tokens, coral = Pitchd, 13 px floor); prototype / Figma references |
- **Rules:** each file aims for ~100–150 lines; a rule that applies to both stacks lives once in the root, never copied into both folders. If a folder file outgrows ~150 lines, move one topic (e.g. migrations, model calls) into a path-scoped file in `.claude/rules/` — not before.
- **Rejected:** A, one root file (grows past 300 lines with two stacks; every session reads all of it); C, topic rule files from the start (many small files, hard to see all the rules, overkill before there's code).
- **Why:** matches the repo's `web/` + `agent/` split, keeps the rules short and relevant, needs no new mechanics.
- **Revisit if:** sessions keep missing a rule from the other folder (e.g. a `web/` change that needs an API contract rule) → move that rule to the root.

### H2 — Where sessions run + work tracking: local-first, plans on the issue (decided 2026-11-10)
- **Where sessions run: local-first.** v2 is built in Claude Code on the founder's own computer, followed and driven from the Claude app via **Remote Control** (as with the inbox sorter). Cloud sessions are an occasional extra (docs, decisions, small fixes, PR follow-ups), and the harness stays cloud-compatible at low priority.
  | Why local | Detail |
  |---|---|
  | DB + migrations | Docker Postgres + PostGIS; reset any time; Alembic tested up and down |
  | Hooks and tools | `uv` / `npm` installed once; fast hook runs |
  | Real-phone testing | `--host` over Wi-Fi for the sheet test and the B3 midday sunlight test |
  | Evals and tool tests | Open network and the founder's API key; long runs fine (cloud's allowlist already blocked NSW Parks once) |
  | Docker / Cloud Run | Build and run the real image |
  - **What cloud still does better:** an isolated sandbox (safer with few permission prompts), several sessions at once, works with the computer off. Local gets parallel work from git worktrees when needed.
  - **Cloud-compatible means:** plans live on GitHub (below); skills work with `gh` or the GitHub MCP tools (H3); hooks use only repo-installed tools (H5); a cloud environment setup script (H9, lowest priority).
- **Work tracking (option B):**
  1. **One GitHub milestone per roadmap phase** (`D1`, `D2`, `D3`, `P1` … `P7`, `P5b`); its description is that phase's "done when" from `learning-roadmap.md`.
  2. **Issues carry acceptance criteria**, as in v1. Labels: `agent`, `web`, `data-agent`, `infra`, `docs`, plus `evals` for anything that changes prompts, tools or model config (ties to H8).
  3. ~~`/plan` posts the plan as an issue comment; `/implement` reads it~~ **Amended by H3:** the plan lives in `planning/<id>/plan.md`, committed on the work branch; the issue gets a one-line link to it.
  4. **One issue → one branch → one PR** with `Closes #n`; small PRs — a phase is several issues.
  5. **No `.claude/context/` folder in v2** (replaced by `planning/`).
- **Rejected:** A, v1's committed plan files (pile up and go stale, noise in PR diffs); C, a markdown backlog (no criteria flow or PR links, merge conflicts); D, a Projects board on top (another thing to sync for one person); a gitignored local plan file (workable local-only, but invisible from the phone, cloud sessions and the CI reviewer).
- **Why:** keeps the issue → `/plan` → `/implement` → PR habit that works; the plan survives any session and reads the same from the desk, the phone and CI — so the reviewer (H7) can check a PR against the agreed plan, not just the criteria.
- **Revisit if:** editing plan comments proves clumsy in practice → try a plan section in the issue body instead.

### H3 — One resumable `/harness` skill; subagents do the heavy work (decided 2026-11-10)
- **Decision (founder's design):** a single `/harness` skill runs the whole build flow and replaces v1's `/plan`, `/implement`, `/pr`, `/address-pr` and `/wrap-up`. Run `/harness 42` (an issue) or `/harness "add get_forecast tool"` (an issue is created at intake). It finds or creates `planning/<id>/`, reads `state.md`, and carries on from the first step not done — so it **resumes at any step** after a break, a crash or a new session.
- **Steps:**
  | # | Step | Who | Writes | Stops for you? |
  |---|---|---|---|---|
  | 1 | Intake: issue or description, label, milestone | Main | `state.md` | No |
  | 2 | Explore: relevant files, confirm what the plan will use exists, the right `CLAUDE.md` | **Explorer** (read-only) | `findings.md` | No |
  | 3 | Plan: acceptance criteria, file-by-file tasks, risks, checks | **Planner** (reads `findings.md`, no code) | `plan.md` | **Yes — approve the plan** (main shows a summary) |
  | 4 | Branch | Main | — | No |
  | 5 | Implement, one task at a time (code + its tests) | **Implementer** per task | Code; tick in `plan.md` | Only if a task fails twice |
  | 6 | Verify, once after all tasks: full tests + type checks for both stacks, build, Alembic down → up if there's a migration, OpenAPI types in sync, every acceptance criterion | **Verifier** (fresh) | `verify.md` | No — failures name the likely task and go back to 5; stops after 2 rounds |
  | 7 | Code review: correctness, edge cases, failure paths, `CLAUDE.md` rules, unhappy-path tests; `[blocking]` / `[suggestion]`; max 2 fix rounds | **Reviewer** (fresh — didn't write the code) | `review.md` | Only if blocking findings remain |
  | 8 | Security review — only when auth, the token route, CORS, secrets, the source allowlist or prompt input are touched | **Reviewer** | `review.md` | Only on unresolved findings |
  | 9 | Evals, if labelled `evals` | **Eval runner** | `evals.md` | No |
  | 10 | PR: `Closes #n`, links `plan.md` + `review.md`, lists suggestions not acted on with a reason each | Main | PR link in `state.md` | No |
  | 11 | CI review follow-up: CI reads `review.md` and looks for what was missed; comments → fix table → fixes | **Triager** → implementer | `review.md` | **Yes — approve the fix list** |
  | 12 | Close: decision log + roadmap docs, milestone progress, move the folder to `planning/done/` | **Doc writer** | Docs | No |
- **Lean main session:** main only reads `state.md`, starts subagents, shows their summaries, takes approvals, and does the small git/GitHub actions (branch, PR, issue link). Every subagent writes its detail to a file in `planning/<id>/` and returns ≤ ~10 lines (what it did, pass/fail, open questions, which file). Main never loads full diffs, test logs or review notes.
  - `/harness` must run in the main session — subagents can't start their own subagents. That also keeps it visible and steerable over Remote Control.
  - Trade-off accepted: each subagent starts cold and re-reads what it needs (more tokens); `findings.md` keeps later cold starts cheap.
- **Checks — two layers, not three:** per edit, hooks format + quick-lint the file (H5); then one full verify at step 6. No per-task test runs (founder's experience: too slow). **Exception:** the planner may mark a task `check first` — mainly a new Alembic migration or an agent API contract change that later tasks build on — and only that task runs its checks before the next starts.
- **Sub-choices:**
  - **Subagents, not separate sessions** (a3); tasks run one after another in the same checkout; a git worktree only if two tasks run in parallel. Separate `claude -p` sessions lose Remote Control visibility and need their own permissions.
  - **Plan files committed** on the work branch (b1) — readable from the phone, by cloud sessions and by the CI reviewer, and reviewed in the PR beside the code. **Amends H2** (which had the plan as an issue comment).
  - **After merge, moved to `planning/done/`** (c2); `CLAUDE.md` says `planning/done/` is history, not instructions.
  - **The issue stays the entry point** (d1): milestones and labels from H2 stand; the issue links to `plan.md`.
  - **`/decide` and `/eval` stay separate skills** (e2); `/harness` calls the eval command at step 9.
- **`state.md`:** the 12-step checklist, branch, PR link, round counters for steps 6/7, and the last thing that happened.
- **Subagent roles needed** (agent files, models and tools settled in H4): explorer, planner, implementer, verifier, reviewer, eval runner; triager and doc writer may be the reviewer and planner with different instructions. `senior-engineer` and `ux-designer` remain advisers.
- **Rejected:** five separate commands (v1) or five skills (option B/C) — more to remember and no resume; merging plan + implement without a checkpoint (D); local-only review or CI-only review — both are used (local review before the PR, CI as an independent second look that reads `review.md`); per-task checks after every task (too slow).
- **Why:** one command to remember, resumable from any step on any machine; the plan-approval checkpoint stays; fresh subagents review work they didn't write; the main session stays small enough to last a whole issue.
- **Revisit if:** cold-start token cost per issue is high in practice → let one implementer do several small tasks; or the end-only verify keeps sending fixes back for two rounds → widen `check first`.

### H3b — Skill selection: project + built-in skills, Superpowers' focused skills inside `/harness` (decided 2026-11-10)
- **Rule:** `/harness` only *requires* project skills (committed in `.claude/skills/`) and built-in Claude Code skills. Plugin skills are used when present, with a fallback — except Superpowers and Figma, which are enabled in the project's committed `.claude/settings.json` (Superpowers pinned to a version).
- **Project skills (new):**
  | Skill | Use |
  |---|---|
  | `/harness` | The build flow (H3) |
  | `/decide` | Founder's decision format — options table, recommendation + why, plain language; on approval record in `decisions.md` (+ topic doc), commit and push. Step 12 uses its format for decisions made during an issue |
  | `/eval` | One repeatable eval run (H8); `/harness` step 9 calls it |
- **Built-in skills:**
  | Skill | Step | Notes |
  |---|---|---|
  | `code-review` | 7 | Effort medium by default, high for complex or `infra` issues, never `max` unless the founder asks; Pitchd's rules come from `CLAUDE.md` + a short Pitchd checklist file |
  | `security-review` | 8 | Only for auth, token, CORS, secrets, allowlist or prompt-input changes |
  | `claude-api` | 3, 5 | Any `agent/` work that calls the model — current model IDs, parameters, migration notes; keeps the Q13 rules right |
  | `run` | 6 | `web/` changes — start the app and check the changed screen works |
  | `update-config`, `fewer-permission-prompts` | H5 / H6 | Writing and tuning hooks and permission rules |
- **Superpowers (`obra/superpowers`, already used in v1 — `docs/superpowers/plans/`) — option C: `/harness` owns the flow, borrows the focused skills:**
  | Step | Skill | Used by |
  |---|---|---|
  | 1–3, only when the ask is vague | `brainstorming` | Main, before the planner; skipped for a clear issue |
  | 5 | `test-driven-development` — **only for `agent/` tools, scoring and thresholds** (where a wrong number is the bug); plain "code + tests" elsewhere | Implementer |
  | 6 failures | `systematic-debugging` | Implementer, on a bounced task |
  | 6 | `verification-before-completion` | Verifier |
  | 11 | `receiving-code-review` — weigh CI comments, push back on wrong ones | Triager |
  | Parallel tasks only | `using-git-worktrees` | Main |
  | H9 setup | `writing-skills` (with `skill-creator`) | Writing `/harness`, `/decide`, `/eval` |
  - **Not used inside `/harness`:** `writing-plans`, `executing-plans`, `subagent-driven-development` (they run their own flow — plans in `docs/superpowers/plans/`, no `state.md` resume, review after every task); `finishing-a-development-branch` (steps 10 + 12 cover it); `dispatching-parallel-agents` (tasks run one after another).
  - **Check at H9:** Superpowers' session-start `using-superpowers` nudge must not pull Claude off `/harness`; if it does, turn it off for the project.
- **Other plugin skills:** `figma-design-to-code` at steps 2 and 5 only when the issue has a Figma link; `skill-creator` for H9 setup.
- **Left out:** `simplify` (overlaps `code-review`; auto-cleanups add PR churn); `frontend-design` (invents its own look — identity is decided in B1–B7); `engineering:code-review` (duplicate); `engineering:architecture` (we use `decisions.md` via `/decide`); `engineering:testing-strategy` / `system-design` (call by hand when useful); `engineering:debug` (Superpowers' `systematic-debugging` covers it); `engineering:deploy-checklist` (reconsider at P3 when Cloud Run deploys start); `loop`, `standup`, `incident-response`, `tech-debt`, docs/office skills.
- **To confirm at H9:** whether `code-review` must be called from the main session (at higher effort it starts its own subagents, and subagents can't start subagents) — if so, its compact findings still keep main lean and the reviewer subagent handles only the Pitchd checklist; and that agent files can preload the skills each role needs (H4).
- **Why:** reuse strong, maintained skills for focused jobs; keep the resumable `planning/` flow and the single end-of-work verify the founder chose.
- **Revisit if:** a Superpowers update changes a borrowed skill's behaviour (hence the pinned version), or its flow skills become configurable enough to replace parts of `/harness`.

### H4 — Subagents: built-in Explore, five role agents, two advisers rewritten (decided 2026-11-10)
- **Decision (option C):**
  | Agent | Source | Model | Can | Can't |
  |---|---|---|---|---|
  | **explorer** | Built-in `Explore` | Its default | Read and search | Edit anything |
  | **planner** (also doc writer) | New | Opus — the plan is where mistakes are cheapest to catch | Read; write in `planning/` and `docs/` | Edit code |
  | **implementer** | New; follows `agent/` or `web/` `CLAUDE.md` by area | Sonnet; Opus for tasks the plan marks complex | Edit code, run commands, use `claude-api` / TDD skills | Push, open PRs, edit `planning/` beyond ticking its task |
  | **verifier** | New | Haiku — runs commands, reads logs | Run checks; write `verify.md` | Edit code — it reports, never fixes |
  | **reviewer** (also triager) | New | Opus — stronger than the code it reviews | Read, read-only commands, `code-review` / `security-review`; write `review.md` | Edit code |
  | **eval-runner** | New | Haiku (the eval grader stays Opus per Q13, set inside `/eval`) | Run `/eval`; write `evals.md` | Edit code or prompts |
  | **senior-engineer** | Rewritten for v2 | Opus | Adviser for design questions — Python agent loop, FastAPI, SQLAlchemy/PostGIS, Cloud Run, Next.js thin client | Not a harness step |
  | **ux-designer** | Rewritten for v2 | Sonnet | Adviser, **and** a second reviewer at step 7 for `web/` UI changes — checks against `vision.md` §4–5 and B1–B7 | Edit code |
- **Agent memory:** nothing carries over from v1 (Prisma patterns, the v1 drawer, weather badges). In v2 only the two advisers keep project memory; the harness roles have none — their state is the `planning/` files, and memory would drift from them.
- **Limits are enforced:** each agent file lists its allowed tools; writes outside `planning/` by the verifier and reviewer are blocked by a hook or permission rule (H5 / H6).
- **Model aliases, not IDs,** in agent files (`opus`, `sonnet`, `haiku`), so a new model release needs no edit.
- **Rejected:** A, built-in agents only (no per-role model or tool limits; instructions repeated in every call); B, a file per role including explorer (duplicates built-in Explore); D, advisers as workers (the same agent reviews its own kind of work; no per-role limits).
- **Why:** each role gets the model it needs — Opus where judgement matters (plan, review), Haiku where it's mechanical (verify, evals) — and the roles that check work can't change it.
- **Revisit if:** Haiku verifiers misread failures → Sonnet; or Opus planning/review costs too much per issue → Sonnet with high effort.

### H5 — Hooks: format + lint-fix per edit, guard rails, no test hooks (decided 2026-11-10)
- **Decision (option C):** hooks in the committed `.claude/settings.json`, so they run the same locally and in cloud.
  | Moment | Hook |
  |---|---|
  | After each file edit | Format + lint-fix that file (ruff for `.py`; Prettier + ESLint for `.ts`/`.tsx`); leftover lint errors are sent back to Claude to fix. ~1 s |
  | Before a tool runs | Guard rails (below) — blocked with a reason Claude sees |
  | Session start | Show open `planning/` items and their current step (helps `/harness` resume) |
  | When Claude stops | Nothing — type checks and tests run only in verify (step 6) and CI |
- **Git pre-commit (lefthook):** the same format + lint on staged files, so every commit is clean whoever makes it.
- **Guard rails:**
  | Blocked | Why |
  |---|---|
  | Reading or editing `.env*` / secrets files | Keys stay out of the transcript |
  | Editing an Alembic migration already on `main` | Applied migrations are history — make a new one |
  | DB commands or migrations whose connection string isn't the local Docker DB | Only CI deploys touch Supabase (Q11) |
  | Verifier or reviewer writing outside `planning/` | Enforces H4's "can't edit code" |
  | Hand edits to `web/`'s generated API types | Regenerate from the OpenAPI spec (Q12) |
- **Tools:**
  | Job | `agent/` (Python) | `web/` (TS) |
  |---|---|---|
  | Packages | uv | npm |
  | Format + lint | ruff | ESLint (Next.js rules) + Prettier |
  | Types (verify + CI) | pyright, standard mode | `tsc --noEmit` |
  | Tests (verify + CI) | pytest + pytest-asyncio against local Docker Postgres + PostGIS | vitest |
  | Pre-commit | lefthook (both stacks) | lefthook |
- **Rejected:** A, no hooks (formatting noise reaches review); B, format only (lint errors wait for verify); D, tests when Claude stops (runs after every reply — slower than the per-task checks already ruled out). Tools: mypy (slower; SQLAlchemy plugin deprecated); Biome (loses the Next.js lint rules); the `pre-commit` framework (needs Python even for `web/`-only work).
- **Why:** catches the cheap problems instantly without slowing work; the guard rails protect secrets, migration history and the live database whatever the session is doing.
- **Revisit if:** the edit hook gets slow as the repo grows → lint only, format at commit; or type errors keep surfacing late at verify → add a per-edit type check for the edited file only.

### H6 — Permissions: committed allow / ask / deny lists, auto mode for `/harness` (decided 2026-11-10)
- **Decision (option C):** rules in the committed `.claude/settings.json`; personal extras in `.claude/settings.local.json` (not committed). **Auto mode** during `/harness` runs, so routine actions don't stall while the founder is away from the phone; default mode otherwise. Deny always wins, in every mode. **Fallback if auto mode isn't available:** option B — the same lists in default mode, accept-edits during implement.
  | Rule | Commands |
  |---|---|
  | **Allow** | Read / search; `uv run` ruff, pyright, pytest; `npm run` lint, typecheck, test, build; `docker compose` for the local DB; Alembic against local; OpenAPI type generation; `git` status, diff, log, add, commit, branch, checkout; `git push` to non-main branches; `gh` issue / PR view and create, issue comment and edit |
  | **Ask** | Adding or upgrading dependencies (`uv add`, `npm install <pkg>`) — supply-chain check; `rm -rf`; network fetches to hosts outside the source allowlist; edits to `.claude/` settings, hooks or agents |
  | **Deny** | Reading `.env*` / secret files; `git push --force`; any push to `main`; `gh pr merge` (the founder merges); `sudo`; `gcloud run deploy`, `vercel deploy`, Secret Manager commands (deploys only via CI with Workload Identity — Q11); DB commands against Supabase (backs up H5's guard) |
- **Push allowed, merge denied:** `main` is protected on GitHub and every change arrives by PR; pushing a feature branch is safe and reversible, merging is the real gate.
- **Later, checked at H9:** Claude Code's bash sandbox (repo-only writes, listed network hosts) as an extra layer — first check it works with Docker and `--host`.
- **Rejected:** A, ask for everything (stalls `/harness` whenever the founder is away); D, bypass inside a dev container (Docker-in-Docker for Postgres, awkward phone testing, gives up H2's local benefits). B kept as the fallback.
- **Why:** `/harness` keeps moving over Remote Control; the dangerous actions — secrets, force pushes, merges, deploys, the live DB — are blocked whatever the mode.
- **Revisit if:** prompts still interrupt often → run `fewer-permission-prompts` and widen the allow list; or auto mode lets through something it shouldn't → add it to deny.

### H7 — CI: three required checks; Claude review once, then on request (decided 2026-11-10)
- **Checks** (GitHub Actions, path-filtered, actions pinned by commit SHA):
  | Job | Runs when | What |
  |---|---|---|
  | **agent** | `agent/` changes | `uv sync`; ruff lint + format check; pyright; pytest against a PostGIS service container; migration round trip (upgrade → downgrade → upgrade); `alembic check` — fails if models changed without a migration |
  | **web** | `web/` changes | `npm ci`; ESLint + Prettier check; `tsc --noEmit`; vitest; `next build` |
  | **contract** | Either changes | Generate the OpenAPI spec, regenerate the TS types, fail if they differ from what's committed — `agent/` and `web/` can't drift (Q12) |
  - Branch protection on `main` requires all three. Deploy workflows (Cloud Run via Workload Identity, Q11) are added at P3.
- **Claude review (option B):** runs once when a PR is opened or marked ready; again only on `@claude review` or a `re-review` label (the triager adds it if a fix round turns out large). Advisory, not a required check — the founder is the merge gate.
- **Review prompt:**
  1. Read the root `CLAUDE.md` plus `agent/` or `web/` `CLAUDE.md`, then the PR's `planning/<id>/plan.md` and `review.md`.
  2. Check the PR against the plan and acceptance criteria, not just the diff.
  3. Pitchd checklist: no DB access in `web/`; site IDs validated from tool results; model + effort from config (Q13); cost cap respected (Q17); untrusted input kept out of instructions; migration present and reviewed; timeouts on external calls; colour tokens, not hex; unhappy-path tests.
  4. Don't repeat anything in `review.md` — look for what it missed.
  5. `[blocking]` / `[suggestion]` inline comments plus a short summary; never approve or request changes.
  6. Model: Opus, matching the local reviewer (H4).
- **Kept from v1:** `claude.yml` for `@claude` mentions on issues and PRs (handy from the phone).
- **Rejected:** A, review on every push (v1 — fix rounds re-reviewed, repeat findings); C, every code-changing push (fix rounds still re-trigger); D, no CI review (loses the independent check and GitHub record).
- **Why:** checks keep both stacks and their contract honest on every push; one independent review per PR is enough once local review has done the heavy work.
- **Revisit if:** problems keep reaching `main` that a later re-review would have caught → switch to C.

### H8 — Tool tests and evals: four tiers (decided 2026-11-10)
- **Decision (option C):**
  | Tier | What | When | Where | Cost |
  |---|---|---|---|---|
  | **1. Tool tests** | Each tool against the test DB; Open-Meteo / Mapbox replayed from recorded responses, never live; strict tool schemas checked; scoring and alert thresholds (TDD, H3b) | Every PR | CI `agent` job + verify (step 6) | Free |
  | **2. Loop tests with a scripted fake model** | Agent-loop mechanics: cost-cap wrap-up (Q17), refusal handling + `stop_reason` checks (Q13), tool-call limits, invented site IDs rejected, resumable event stream | Every PR | Same | Free |
  | **3. Smoke eval** | ~5 real queries; deterministic checks + grader; compared with the baseline | `/harness` step 9 when labelled `evals` (prompts, tool descriptions or schemas, model config, scoring) | Local, founder's API key | ~US$1 |
  | **4. Full eval** | The 20–50 query set (Matt's weekend asks, Sarah's multi-day trips, ask-or-assume cases, misheard place names) + data-agent accuracy on the D2 reviewed sites | `/eval full` by hand; **required before merging any model or prompt config change** and at each model release | Local; also a manual GitHub workflow for cloud use | ~US$10–25 per setup |
- **Grading:** deterministic checks first (site IDs real, constraints met — dogs, drive limit, weather — asked only when the ask-or-assume rules say so), then the Opus grader (Q13) for quality and voice. Every run reports quality, cost per trip and time to first pins against the baseline.
- **Layout in `pitchd-v2`:** `agent/evals/cases/` (query files — new cases from real logs, every bug found, and Sarah's queries from the start); `agent/evals/baseline.json` (last accepted scores, committed; an accepted full run updates it in the same PR); raw run logs in an ignored folder or CI artifacts, never committed.
- **Spend guard:** `/eval` caps a run at US$30 — stops and reports if exceeded (same idea as Q17).
- **Before phase 5:** tiers 3–4 start with the first hand-written cases in phase 1 (logging from day one); the D1 pilot's hand reviews become the data agent's first set.
- **Rejected:** A, full evals on every PR (~US$10–25 per push); B, evals only by hand (model and prompt changes merge unmeasured); D, a nightly full eval (~US$300–700 a month for little gain at one user).
- **Why:** free tests guard every change; real-model runs happen exactly where model behaviour can change, so the phase 5 model choice and every later switch are made from evidence.
- **Revisit if:** data changes start shifting answers between model changes → add a weekly smoke eval; or the full set outgrows the run cap → split it by persona.

### H9 — Setup order: core first, a dry run, the rest when a phase needs it (decided 2026-11-10)
- **Decision (option B, with C's dry run):**
  | # | Step | Who | Notes |
  |---|---|---|---|
  | 0 | Create the `pitchd-v2` repo, the Supabase project (Sydney) and the GitHub secret for Claude review | Founder | Pre-code checklist |
  | 1 | Move `docs/revamp/` into `pitchd-v2/docs/` (this doc included); freeze v1 | Session | Pre-code checklist |
  | 2 | **Core harness, by hand:** `agent/`, `web/`, `planning/` layout; the three `CLAUDE.md` files (H1); `.claude/settings.json` with permissions (H6), hooks (H5), Superpowers pinned + Figma; lefthook; five role agents + two rewritten advisers (H4); `/harness` and `/decide` skills + shared checklist files (H3); `docker compose` Postgres + PostGIS; CI checks + review workflows (H7); branch protection | Local session, using `writing-skills` / `skill-creator` | No product code |
  | 3 | **Check the open points:** must `code-review` run from the main session? Can agent files preload skills? Does Superpowers' session-start nudge override `/harness`? Is auto mode available? Does the bash sandbox work with Docker and `--host`? | Session | Each answer goes back into its H entry |
  | 4 | **Dry run:** a tiny issue through all 12 steps — e.g. "agent/ health endpoint + first Alembic migration enabling PostGIS" (exercises `check first`, CI, review, PR) | `/harness` | Fix the harness from what goes wrong, then start real work |
  | 5 | At P1 (first eval cases): `/eval` + eval-runner tiers 3–4 | `/harness` | Tiers 1–2 run in CI from step 2 |
  | 6 | At P3 (first deploy): Cloud Run + Vercel deploy workflows with Workload Identity; consider `deploy-checklist` | `/harness` | Q11 |
  | 7 | Lowest priority: cloud environment setup script | `/harness` | H2's "cloud-compatible" |
- **Not blocking the harness, but before the data pilot:** NSW National Parks terms check (Q21).
- **Rejected:** A, everything up front (days of setup; `/eval` and deploys have nothing to work on yet); C alone, building the harness with a half-built harness from the start; D, copying v1's setup (brings back the Prisma / Haiku-only rules v2 replaced).
- **Why:** each piece arrives when there's something real to test it on; the dry run shakes out the harness on a tiny issue before it carries real work.
- **Revisit if:** the dry run shows a core piece is missing or wrong → fix it before the next issue, not mid-phase.
