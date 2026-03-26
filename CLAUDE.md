# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview
**Pitchd** is an AI-powered camping travel and planning companion for Australian campers. Users describe a trip in plain English and Pitchd interprets the query, checks live weather, finds matching campsites and nearby amenities, and displays everything on an interactive map.

**Core differentiator:** Natural language search with live weather-awareness.
**Target market:** Australian campers (primary), architecture should allow future expansion.
**Current stage:** Phase 5 — M7 in progress (polish & beta launch). M1–M6 complete. App live at https://pitchd-app.vercel.app.
**GitHub:** github.com/mrdlam87/pitchd-app

---

## Key docs
- `docs/project-context.md` — project overview, personas, MVP features, phases, session log
- `docs/technical/system-architecture.md` — **how the system is actually built**: components, API routes, data flows, gotchas
- `docs/technical/technical-design.md` — original architecture decisions and milestone definitions
- `docs/ux-session-1.md` — UX decisions from prototype phase

---

## Prototype (reference only)

The prototype lives in `prototypes/` — a standalone Vite + React app used for design and UX validation. It is **not** the production app. Refer to it for UI/UX decisions, component behaviour, and design patterns.

### Running the prototype
```bash
cd prototypes
npm install
npm run dev          # localhost:5173
npm run dev -- --host  # expose on local network for mobile testing
```

### Prototype architecture
Everything lives in a single file: `prototypes/pitchd-light-v2.jsx`. Entry point is `main.jsx`.

**Component tree:**
```
PitchdLight          ← root, owns all state (screen, results, searchState, etc.)
├── HomeScreen       ← landing page with NL search textarea + quick chips
├── MapScreen        ← map + sliding bottom drawer (peek / half / full)
│   ├── MapController  ← react-leaflet hook: fits bounds + exposes map ref
│   ├── SearchBar    ← always floats at top, shared across drawer states
│   ├── QuickFilterChips  ← horizontal scroll row of filter shortcuts
│   └── FilterPanel  ← full-screen overlay, triggered from SearchBar "Filters"
```

**Key data flow:**
- `PitchdLight` holds `screen` ("home" | "results"), `results[]`, `amenityResults[]`, `searchState`
- `searchFromNL(query)` → calls `parseNL()` (Claude API) → calls `runSearch()` → sets results → navigates to "results" screen
- `showAmenity(type)` → filters static amenity data → sets `amenityResults`, clears `results` → navigates to "results"
- `runSearch()` → calls `fetchWeather()` (mocked in prototype, real Open-Meteo in production) → sets results

**Navigation:** Swipe left from home → map. Swipe right from map left edge (<40px) → home. No router.

**Capture mode:** `?capture=results|drawer|filters|loading|map-loading` URL params auto-navigate to specific states — used for Figma screen captures only.

**Live API calls in prototype:**
- `parseNL()` calls Anthropic API directly from the browser (requires CORS — prototype only, never do this in production). Uses `claude-sonnet-4-20250514`.
- Weather is **mocked** in `fetchBatch()` — no real Open-Meteo calls yet.

---

## Production App (Next.js — Phase 5)

### Tech stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| Auth | Auth.js (NextAuth) + Google OAuth |
| AI | Anthropic Claude API (Haiku for MVP) |
| Weather | Open-Meteo (free, no API key) |
| Database | PostgreSQL via Prisma ORM |
| Hosted DB | Supabase |
| Map | Mapbox |
| Deployment | Vercel |

### Conventions
- TypeScript throughout
- Tailwind utility classes only — no custom CSS files
- Prisma for all DB interactions — no raw SQL
- Next.js App Router (not Pages Router)
- Prefer server components; use client components only when needed
- All API routes in `/app/api/`
- Environment variables in `.env.local`

### UI conventions
- **Weather signal = coloured map pins** — pins are colour-coded by weather score; no badge on cards (cards already have weather day columns). Do not add weather badges to campsite cards.
- Design tokens are centralised in `app/lib/tokens.ts` — import from there, don't hardcode hex values
- **Always reference the prototype before writing UI code** — check `prototypes/pitchd-light-v2.jsx` for colours, spacing, typography, component behaviour, and design patterns
- **Figma is the source of truth for visual design** — use the Figma MCP (`get_design_context`, `get_screenshot`) when a Figma URL is available
- **Design tokens from the prototype** (use these, don't invent new values):
  - Background: `#f7f5f0`
  - Forest green (headings): `#2d4a2d`
  - Sage (secondary text): `#5a7a5a`
  - Coral (CTA / accent): `#e8674a`
  - Warm border: `1.5px solid #e0dbd0`
  - Wordmark: "Pitch" in forest green + "d" in coral, Lora serif, bold

### Testing
- Integration tests live in `app/tests/api/<route>.test.ts` — run with `npm test`
- Auth is mocked: `vi.mock("@/auth")` + cast `auth as () => Promise<Session | null>` to avoid middleware overload
- Seed test records with `source: "test"` — cleaned up in `afterEach` via `prisma.X.deleteMany({ where: { source: "test" } })`
- Prefix seeded record names with `"!"` so they sort first alphabetically (guaranteed on page 1)
- `tests/global-setup.ts` loads `.env.local` before Prisma singleton initialises — required for local test runs
- Custom `Session` type in `types/next-auth.d.ts` requires `role: UserRole` in the user object

### Data notes
- `CampsiteAmenity` join table is empty — campsites have no linked amenities until M4
- Amenity filter uses standard query param style: `?amenities=toilet&amenities=bbq` (not PHP-style `amenities[]`)

### Auth
- Google OAuth only — no passwords stored
- MVP is closed/invite-only — access controlled via `role` field (`admin` | `beta` | `user`)
- All API routes are protected

### AI
- Claude Haiku for all MVP AI features — not Sonnet or Opus
- Cache AI responses in `SearchCache` — never call the API for repeated queries
- Only invoke AI for natural language input; use DB filters for simple queries

### Development milestones
| Milestone | Focus |
|---|---|
| M1 | Project foundation — scaffold, auth, deploy |
| M2 | Campsite data pipeline — OSM ingestion, DB seeded |
| M3 | Map & browse mode — pins, user location, navigate |
| M4 | Filters & amenities — filter panel wired to DB |
| M5 | AI search — Claude integration, Pitchd pick |
| M6 | Weather — Open-Meteo, badges, weather-aware ranking |
| M7 | Polish & beta launch |

---

## Claude Code agents

Two custom agents live in `.claude/agents/` — invoke by asking Claude directly:
- `senior-engineer` — architecture decisions, TypeScript/Next.js debugging, performance optimisation
- `ux-designer` — UI/UX design decisions, interaction patterns, design critique; draws on Google Maps and AllTrails patterns

Agent memory (accumulated across sessions) lives in `.claude/agent-memory/<agent-name>/MEMORY.md`.

---

## Branch & PR workflow
- `main` is protected — all changes via PRs
- Branch naming: `feature/`, `chore/`, `fix/` prefixes
- Claude PR review available on-demand: comment `@claude` on any PR
- CI: `.github/workflows/claude-review.yml`

---

## Before writing code

Think through these before touching a file — not after:

- **Input contract** — for every input (user, DB, external API): what are the valid types, ranges, and edge cases? (e.g. `0` is falsy but valid, `±90°` causes divide-by-zero, empty string vs null vs undefined behave differently with `??` vs `||`)
- **Failure paths** — what happens when each external call fails? Cache writes, API calls, and DB queries can all throw. Decide upfront whether failure should propagate or be swallowed.
- **Security** — does any user-controlled string flow into a prompt, query, or template? Apply escaping or parameterisation at the point of use.
- **Performance guards** — are there unbounded queries or loops? Add `take`, timeouts, and caps before they're needed, not after a reviewer spots them.
- **Test coverage** — write tests for the unhappy paths (SDK errors, bad cached data, edge-case inputs) at the same time as the happy path.

## Pre-PR self-review

Before opening a PR, re-read every file you changed and ask:

- **Edge cases & failure modes** — are there states not handled? (e.g. records that should be cleaned up, missing null checks, partial failure mid-batch)
- **Operational concerns** — are there missing timeouts, no guard against concurrent runs, unbounded loops, or silent failure paths?
- **Data integrity** — does the implementation handle the full lifecycle? (e.g. not just inserting/updating, but also marking stale or removed records)
- **Scope completeness** — does the implementation match the *intent* of the issue, or just its literal acceptance criteria?

Fix any issues found before raising the PR.
