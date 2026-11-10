# Harness Workflow — How v2 Is Built with Claude Code

> First item on the pre-code checklist in `open-questions.md`. This is about the **Claude Code development workflow** for `pitchd-v2`: how the code gets written, checked and reviewed. It is *not* about the Pitchd agent's own harness (its tool loop and prompts), which is covered in `architecture.md`.
> Status: in progress, one decision at a time (H1–H9). Each decision is recorded here and in `decisions.md` once approved.

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
| H2 | Where sessions run + work tracking — issues, plans, how a piece of work flows | **Decided:** local-first via Remote Control; milestones per phase, plan as an issue comment |
| H3 | Skills / commands — updated `/plan`, `/implement`, `/pr`, others; new ones | Open |
| H4 | Subagents — `senior-engineer`, `ux-designer`, any new ones; agent memory | Open |
| H5 | Hooks — format / lint / test for Python + TS, guard rails | Open |
| H6 | Permissions — allow / ask / deny rules | Open |
| H7 | CI — checks and Claude review on PRs | Open |
| H8 | Tool tests and eval runs — where they fit | Open |
| H9 | Setup order — what gets created in `pitchd-v2` before the first line of code | Open |

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
  3. **`/plan <n>` posts the agreed plan as a single "Plan" comment on the issue** and refines the criteria; changes edit that comment, not add another.
  4. **`/implement <n>` reads that comment first** and ticks criteria as they're met.
  5. **One issue → one branch → one PR** with `Closes #n`; small PRs — a phase is several issues.
  6. **No `.claude/context/` folder in v2.**
- **Rejected:** A, v1's committed plan files (pile up and go stale, noise in PR diffs); C, a markdown backlog (no criteria flow or PR links, merge conflicts); D, a Projects board on top (another thing to sync for one person); a gitignored local plan file (workable local-only, but invisible from the phone, cloud sessions and the CI reviewer).
- **Why:** keeps the issue → `/plan` → `/implement` → PR habit that works; the plan survives any session and reads the same from the desk, the phone and CI — so the reviewer (H7) can check a PR against the agreed plan, not just the criteria.
- **Revisit if:** editing plan comments proves clumsy in practice → try a plan section in the issue body instead.
