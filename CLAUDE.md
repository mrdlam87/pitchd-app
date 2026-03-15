# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview
**Pitchd** is an AI-powered camping travel and planning companion for Australian campers. Users describe a trip in plain English and Pitchd interprets the query, checks live weather, finds matching campsites and nearby amenities, and displays everything on an interactive map.

**Core differentiator:** Natural language search with live weather-awareness.
**Target market:** Australian campers (primary), architecture should allow future expansion.
**Current stage:** Pre-development — UI prototype exists, Next.js app not yet started.
**GitHub:** github.com/mrdlam87/pitchd-app

---

## Prototype (current working code)

The prototype lives in `prototypes/` — a standalone Vite + React app used for design and UX validation. It is **not** the production app.

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

## Planned Production App (Next.js — not yet built)

### Intended tech stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| AI | Anthropic Claude API (Haiku for MVP) |
| Weather | Open-Meteo (free, no API key) |
| Database | PostgreSQL via Prisma ORM |
| Hosted DB | Supabase |
| Map | TBD (Mapbox or Google Maps) |
| Deployment | Vercel |

### Conventions (for when Next.js app is built)
- TypeScript throughout
- Tailwind utility classes only — no custom CSS files
- Prisma for all DB interactions — no raw SQL
- Next.js App Router (not Pages Router)
- Prefer server components; use client components only when needed
- All API routes in `/app/api/`
- Environment variables in `.env.local`

### AI cost management
- Use Claude Haiku for all MVP AI features (not Sonnet/Opus)
- Cache AI responses — don't call the API for repeated or similar queries
- Rate limit free users on AI searches per day
- Invoke AI only for natural language input; use traditional filters for simple queries

---

## Branch & PR workflow
- `main` is protected — all changes via PRs
- Branch naming: `feature/`, `chore/`, `fix/` prefixes
- Claude PR review available on-demand: comment `@claude` on any PR
- CI: `.github/workflows/claude-review.yml`

---

## Current phase
See `docs/project-context.md` for full planning detail.
