# Open Questions

## v2 rebuild (answer first — these shape everything else)
- **A. What's wrong with v1's UI?** **Answered:** glitchy drawer; journey not well thought out or intuitive. Lessons and v2 design principles captured in `vision.md` §4.
- **B. Brand:** ~~name~~ **kept as Pitchd.** ~~Visual identity~~ **Decided (B1–B7):** keep the palette family with coral = Pitchd only; dark mode follows the phone; default light theme built for sunlight; sun-to-rain weather colours; coral "d" app icon and agent mark; Lora + DM Sans (see `decisions.md`).
- **C. Platform:** **Decided:** mobile-first web first, native later (see `decisions.md`).
- **D. Repo & database:** **Decided:** new `pitchd-v2` repo + separate Supabase project (see `decisions.md`).
- **E. Agent personality & scope:** **Decided:** knowledgeable local mate; camping-trip scope; safety first (see `decisions.md`).
- **F. v1's future:** **Decided:** freeze now, keep live as fallback, retire after ~3 real trips in v2 (see `decisions.md`).
- **G. Next users:** **Decided:** staged rollout — founder → 3–5 trusted campers → 20–50 closed beta, each gated by criteria (see `decisions.md`). *Open: names for stage 2.*

## ⚠️ Before touching any v2 code
- [ ] **Set up the harness workflow** — define how v2 is built with Claude Code before the first line of code: `CLAUDE.md` conventions, skills/commands (e.g. updated `/plan`, `/implement`, `/pr`), subagents (`senior-engineer`, `ux-designer`), hooks (lint/test/format), permissions, CI review, and how agent-harness concerns (eval runs, tool tests) fit in. Include the conventions from the Technical decisions: Q12 (SQLAlchemy + Alembic, Supabase gotchas), Q11 (Cloud Run, auth token flow), Q17 (cost caps) and Q13 (model switching rules). *Confirmed: this means the Claude Code development workflow (how v2 is built), not the Pitchd agent's own harness.*
- [x] Repo + database decided (D)
- [ ] NSW National Parks terms + robots.txt checked and recorded as the first source-allowlist entry (Q21) — before the data agent pilot
- [ ] `pitchd-v2` repo created on GitHub (founder) and new Supabase project created
- [ ] Docs moved from `docs/revamp/` into the v2 repo
- [ ] v1 frozen: open M7 issues/PRs closed or labelled "v1 frozen"

## Product & UX
1. ~~**Layout**~~ **Decided:** map-first with a two-snap conversation sheet; sidebar on desktop (see `decisions.md`).
2. ~~**Home screen**~~ **Decided:** no separate home — open on the map, collapsed sheet is home, upcoming trip card leads (see `decisions.md`).
3. ~~**Clarifying questions**~~ **Decided:** assume + show editable chips; ask one question only when there's no default and a wrong guess would ruin the answer (see `decisions.md`).
4. ~~**Voice input**~~ **Decided:** dictation into the input box (browser speech recognition, check before sending); full voice mode waits for native (see `decisions.md`).
5. ~~**Proactive messages**~~ **Decided:** in-app trip card + web push, email fallback; opt-in per trip; strict triggers; safety always (see `decisions.md`).
6. ~~**Memory**~~ **Decided:** stated facts saved automatically with Undo; inferences asked first; shown in chips when used; "What Pitchd knows" list + conversational edits (see `decisions.md`).
7. ~~**Sarah's multi-day route planning**~~ **Decided:** trips modelled as ordered stops from day one + "on the way" amenities in the first build; full multi-day itineraries in new roadmap phase 5b, straight after evals, before the stage 2 caravan tester (see `decisions.md`).
8. ~~**Offline / patchy signal**~~ **Decided:** first build copes with weak signal (resumable streams, designed offline states, saved trips offline); trip pack + queued messages with the "On the trip" stage; offline maps with native (see `decisions.md`).
9. ~~**Name & positioning**~~ **Resolved:** keeping "Pitchd" (see B in `decisions.md`). Visual identity refresh decided (B1–B7).
24. ~~**Campsite availability**~~ **Decided:** know whether to book, "Check & book" link, busy-period warnings + backup, "Not booked yet" nudge; never claim availability unless checked; live checks a later spike (see `decisions.md`).

## Technical
10. ~~Repo layout~~ **Resolved:** new `pitchd-v2` repo (see D).
11. ~~**Agent hosting**~~ **Decided:** Cloud Run in Sydney (service for the planner, Jobs + Scheduler for background work), Supabase in Sydney; browser streams directly with a short-lived token (see `decisions.md`).
12. ~~**Python data layer**~~ **Decided:** Python owns the schema (SQLAlchemy 2.0 + Alembic, PostGIS); the web app has no database access and reads through the agent service's API (see `decisions.md`).
13. ~~**Models**~~ **Decided:** start with a Sonnet 5.5 planner + Haiku 5.5 sub-tasks; phase 5 evals pick the cheapest setup that passes within US$0.30/trip; switching rules keep changes to config + eval (see `decisions.md`).
14. ~~**Managed Agents**~~ **Decided:** self-host now (weather watch is a plain Cloud Run Job); trial Managed Agents for the data agent at D3 against our own loop (see `decisions.md`).
15. ~~**Routing data**~~ **Decided:** straight-line estimate in PostGIS, Mapbox Matrix only for the ~10 sites shown; own-data geocoding first; self-host a router if Mapbox passes ~US$50/month (see `decisions.md`). *Confirm Mapbox prices and terms before the build.*
16. ~~What happens to the current `/api/search` pipeline?~~ **Resolved:** becomes the agent's `search_campsites` tool (see `decisions.md`).

## Data agent
19. ~~**Auto-approve threshold**~~ **Decided:** no-change re-checks apply; pilot reviews everything; then auto-approve per fact key once ≥ 95% agreement over ≥ 30 reviews (official + high only); cautious changes apply at once and are flagged; 1-in-20 spot checks (see `decisions.md`).
20. ~~**Review UI**~~ **Decided:** terminal review tool for the pilot; `/admin/review` page at D3 on the same review functions (see `decisions.md`).
21. ~~**Source access**~~ **Decided:** open data first; then polite reads of an allowlist of official sites, each terms-checked before it's added; store facts + short quotes + link; ask authorities for feeds later (see `decisions.md`).
22. **User reports:** how are they weighed — and how many reports before a fact changes?
23. **Display:** how does the UI show freshness/confidence without clutter?

## Scaling & cost
17. ~~Budget per planned trip~~ **Decided:** ≤ US$0.30 per trip (median), hard cap US$1.50 per conversation, per-user caps from stage 2 (see `decisions.md`).
18. ~~When does the beta open?~~ **Resolved:** see G.
