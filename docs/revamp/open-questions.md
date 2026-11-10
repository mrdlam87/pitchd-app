# Open Questions

## v2 rebuild (answer first — these shape everything else)
- **A. What's wrong with v1's UI?** **Answered:** glitchy drawer; journey not well thought out or intuitive. Lessons and v2 design principles captured in `vision.md` §4.
- **B. Brand:** ~~name~~ **kept as Pitchd.** Visual identity refresh, worked through one sub-question at a time: ~~B1 palette~~ **decided** (keep the family, coral = Pitchd only); ~~B2 dark mode~~ **decided** (follow the phone, with an override); ~~B3 sunlight contrast~~ **decided** (default light theme built for outdoors); ~~B4 weather-state colours~~ **decided** (sun-to-rain scale); B5 wordmark at icon size + app icon, B6 agent-presence mark, B7 type — still open.
- **C. Platform:** **Decided:** mobile-first web first, native later (see `decisions.md`).
- **D. Repo & database:** **Decided:** new `pitchd-v2` repo + separate Supabase project (see `decisions.md`).
- **E. Agent personality & scope:** **Decided:** knowledgeable local mate; camping-trip scope; safety first (see `decisions.md`).
- **F. v1's future:** **Decided:** freeze now, keep live as fallback, retire after ~3 real trips in v2 (see `decisions.md`).
- **G. Next users:** **Decided:** staged rollout — founder → 3–5 trusted campers → 20–50 closed beta, each gated by criteria (see `decisions.md`). *Open: names for stage 2.*

## ⚠️ Before touching any v2 code
- [ ] **Set up the harness workflow** — define how v2 is built with Claude Code before the first line of code: `CLAUDE.md` conventions, skills/commands (e.g. updated `/plan`, `/implement`, `/pr`), subagents (`senior-engineer`, `ux-designer`), hooks (lint/test/format), permissions, CI review, and how agent-harness concerns (eval runs, tool tests) fit in. *Confirmed: this means the Claude Code development workflow (how v2 is built), not the Pitchd agent's own harness.*
- [x] Repo + database decided (D)
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
9. ~~**Name & positioning**~~ **Resolved:** keeping "Pitchd" (see B in `decisions.md`). Visual identity refresh still open.
24. ~~**Campsite availability**~~ **Decided:** know whether to book, "Check & book" link, busy-period warnings + backup, "Not booked yet" nudge; never claim availability unless checked; live checks a later spike (see `decisions.md`).

## Technical
10. ~~Repo layout~~ **Resolved:** new `pitchd-v2` repo (see D).
11. **Agent hosting:** Fly.io vs Railway vs Render vs Cloud Run.
12. **Python data layer:** SQLAlchemy vs psycopg with plain SQL vs calling existing Next.js API routes as tools. (Note: current convention says Prisma only for the Next.js app.)
13. **Models:** which models for planning vs sub-tasks — decide with evals in phase 5. `CLAUDE.md` currently says Haiku for MVP; revisit for the agent.
14. **Managed Agents:** use for the weather-watch / scheduled work, or self-host everything?
15. **Routing data:** drive times — Mapbox Directions cost at scale?
16. ~~What happens to the current `/api/search` pipeline?~~ **Resolved:** becomes the agent's `search_campsites` tool (see `decisions.md`).

## Data agent
19. **Auto-approve threshold:** which changes can skip human review (e.g. high-confidence, official source only)?
20. **Review UI:** a simple admin page, a CLI, or a spreadsheet export for reviewing proposals?
21. **Source access:** do park authority sites allow automated access? Check terms; prefer official open-data feeds (e.g. data.gov.au) where they exist.
22. **User reports:** how are they weighed — and how many reports before a fact changes?
23. **Display:** how does the UI show freshness/confidence without clutter?

## Scaling & cost
17. Budget per planned trip — what's acceptable?
18. ~~When does the beta open?~~ **Resolved:** see G.
