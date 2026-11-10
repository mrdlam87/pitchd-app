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
| H1 | `CLAUDE.md` layout — one file or split per folder | Open |
| H2 | Work tracking — issues, plan files, how a piece of work flows | Open |
| H3 | Skills / commands — updated `/plan`, `/implement`, `/pr`, others; new ones | Open |
| H4 | Subagents — `senior-engineer`, `ux-designer`, any new ones; agent memory | Open |
| H5 | Hooks — format / lint / test for Python + TS, guard rails | Open |
| H6 | Permissions — allow / ask / deny rules | Open |
| H7 | CI — checks and Claude review on PRs | Open |
| H8 | Tool tests and eval runs — where they fit | Open |
| H9 | Setup order — what gets created in `pitchd-v2` before the first line of code | Open |

<!-- Decisions are filled in below as they're made. -->
