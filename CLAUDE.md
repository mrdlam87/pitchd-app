# CLAUDE.md — Pitchd
> This file is automatically read by Claude Code at the start of every session. It provides project context, conventions, and guidance for AI-assisted development.

---

## Project Overview
**Pitchd** is an AI-powered camping travel and planning companion for Australian campers. Planning a camping trip currently means spending hours across multiple apps answering basic questions — where should I go? Will it rain? Is there a dump point? Can I bring my dog? Pitchd solves this in a single natural language query.

Users describe what they want in plain English, and Pitchd interprets their request, checks live weather, finds matching campsites and nearby amenities, and displays everything on an interactive map.

**Core differentiator:** AI-powered natural language search with live weather-awareness — no competing camping app offers this.
**Target market:** Australian campers (primary)
**Current stage:** Pre-development — design & architecture phase
**GitHub:** github.com/mrdlam87/pitchd-app

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Most in-demand React framework, handles frontend + backend in one project |
| Backend | Next.js API Routes | Keeps stack unified, no separate server needed for MVP |
| AI | Anthropic Claude API (Haiku for MVP) | Powers natural language search interpretation, cost-effective at small scale |
| Weather | Open-Meteo | Free, no API key needed, great Australian coverage |
| Database | PostgreSQL + Prisma ORM | Battle-tested DB, Prisma makes it approachable with type safety |
| Hosted DB | Supabase | Managed Postgres, generous free tier, no vendor lock-in |
| Map | TBD (Mapbox or Google Maps) | To be decided in architecture phase |
| Deployment | Vercel | Native Next.js integration, auto CI/CD from GitHub |
| Version Control | GitHub | Industry standard |
| Data Sources | OpenStreetMap, data.gov.au, state park APIs | Free, open Australian camping and amenity data |

---

## MVP Features
1. **Natural language search** — interpret plain English queries (e.g. *"dog-friendly campsite within 3 hours of Sydney where it's not raining this weekend"*)
2. **Weather-aware results** — integrate Open-Meteo forecasts into search to surface campsites in dry regions
3. **Map-first UI** — display results on an interactive map
4. **Core filters** — dog-friendly, fishing, swimming, dump points, public toilets, water fill stations, laundromats, nearby hikes
5. **Open in Google Maps** — one-tap link on every campsite and amenity to open directions in Google Maps

---

## Project Structure
```
/
├── CLAUDE.md                  ← You are here
├── README.md                  ← Human-facing overview
├── docs/
│   └── project-context.md     ← Full planning & research doc
└── ... (app code to come)
```

---

## Development Conventions
- Use TypeScript throughout
- Use Tailwind utility classes for all styling — no custom CSS files
- Use Prisma for all database interactions — no raw SQL
- Use Next.js App Router (not Pages Router)
- Keep components small and single-purpose
- Prefer server components where possible, client components only when needed
- All API routes go in `/app/api/`
- Environment variables go in `.env.local` (never commit this file)

---

## Key Decisions & Rationale
- **Next.js over separate frontend/backend** — keeps the stack unified for a solo developer
- **Claude Haiku for MVP AI** — cost-effective for natural language search interpretation, upgrade to Sonnet/Opus for more complex features post-MVP
- **Cache AI responses** — identical or similar searches return cached results to control API costs
- **Open-Meteo for weather** — free, no API key required, excellent Australian coverage
- **Supabase** — managed Postgres with a free tier, no vendor lock-in (standard Postgres underneath)
- **Vercel** — native Next.js integration, auto CI/CD from GitHub pushes
- **Australia-first** — scoped to AU data sources initially, architecture should allow future expansion

---

## AI Cost Management
- Use Claude Haiku for all MVP AI features
- Cache AI responses — don't call the API for repeated or similar queries
- Rate limit free users on AI searches per day
- Use traditional filters for simple queries, invoke AI only for natural language input
- Set up cost alerts in the Anthropic Console from day one

---

## Current Phase
See `docs/project-context.md` for full planning detail and current phase status.
**Current phase:** Phase 2 — User Personas & Problem Statement