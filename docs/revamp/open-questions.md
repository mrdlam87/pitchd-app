# Open Questions

## v2 rebuild (answer first — these shape everything else)
- **A. What's wrong with v1's UI?** **Answered:** glitchy drawer; journey not well thought out or intuitive. Lessons and v2 design principles captured in `vision.md` §4.
- **Next step for layout (Product & UX #1):** map-first, but the conversation sheet is redesigned from scratch — not v1's drawer.
- **B. Brand:** ~~name~~ **kept as Pitchd.** Visual identity: recommendation is to refresh, not rethink — confirm during design.
- **C. Platform:** mobile-first web (PWA) first then native, or straight to native (React Native / Expo)? → Leaning web first, native later.
- **D. Repo:** new `pitchd-v2` repo (`web/` + `agent/`) or a `v2/` folder here? → Leaning new repo.
- **E. Agent personality & scope:** tone, how Aussie, and how strictly it stays on camping topics.
- **F. v1's future:** keep running until v2 replaces it, freeze it, or retire it early?
- **G. Who's the next user after the founder,** and when?

## Product & UX
1. **Layout:** map-first with a conversation sheet (evolves today's drawer), or conversation-first with the map as a panel? → Leaning map-first; prototype both.
2. **Home screen:** keep a home screen at all, or open straight onto the map with the agent prompt?
3. **Clarifying questions:** how eager? Ask before searching, or assume and show editable assumptions? → Leaning "assume + show".
4. **Voice input:** worth it early (planning in the car, hands busy at camp)?
5. **Proactive messages:** push notifications, email, or in-app only for weather-watch alerts?
6. **Memory:** what should Pitchd remember automatically vs only when asked? How does the user see and edit it?
7. **Sarah's multi-day route planning:** revamp phase 2, or later?
8. **Offline / patchy signal** on the trip — how much matters for v1?
9. **Name & positioning:** does "Pitchd" still fit an agent companion? (Probably yes.)

## Technical
10. **Repo layout:** `agent/` folder in this repo (monorepo) vs a separate repo?
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
18. When does the beta open beyond the founder, and who's next?
