# Pitchd Revamp — Agent-first

> Living workspace for the agent-first revamp of Pitchd. Brainstorming stage — nothing here is final.
> Start any new session with: *"Read `docs/revamp/` and let's continue."*

| Doc | What's in it |
|---|---|
| [vision.md](vision.md) | What Pitchd is becoming, who it's for, and the agent-first UX |
| [architecture.md](architecture.md) | Proposed system shape: Next.js frontend + Python agent service |
| [data-agent.md](data-agent.md) | Second agent track: campsite data enrichment, verification and dedupe |
| [learning-roadmap.md](learning-roadmap.md) | Phased build plan that doubles as a learning path |
| [decisions.md](decisions.md) | Decision log — what we chose and why |
| [open-questions.md](open-questions.md) | Things still to work out |

## Status
- **Stage:** Brainstorming (started 2026-11-09). Core v2 questions A–G answered 2026-11-10 — see `decisions.md`. Product & UX: layout and home screen decided 2026-11-10; working through the rest.
- **Current app:** M1–M6 live at https://pitchd-app.vercel.app — stays running while the revamp is explored
- **Goals:** (1) make the agent the focal experience, (2) a hands-on learning exercise in building agents, (3) start with one user (the founder) but design to scale

## Next session — start here
1. Read every file in `docs/revamp/` (start with `decisions.md` and `open-questions.md`).
2. **Next up:** work through the **Product & UX** design-stage questions in `open-questions.md` one at a time — ~~layout~~, ~~home screen~~ (done), ask-or-assume, memory, proactive alerts, voice — giving a recommendation and the reasoning for each, then recording the founder's decision in `decisions.md` (and `vision.md` where relevant).
3. Format the founder likes: one question at a time, options table, clear recommendation + why, record on approval, commit and push after each.
4. Remember the pre-code checklist in `open-questions.md` — the Claude Code development workflow must be set up in `pitchd-v2` before any code.
