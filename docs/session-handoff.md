# Pitchd — Session Handoff Note
> Paste this at the start of a new Claude conversation to resume where we left off.

---

## What is Pitchd?
Pitchd is an AI-powered camping travel and planning companion for Australian campers. Users describe a trip in plain English and Pitchd interprets the query, checks live weather, finds matching campsites and nearby amenities, and displays everything on an interactive map.

**In one sentence:** What used to take hours now takes seconds.

**App:** https://pitchd-app.vercel.app
**GitHub:** https://github.com/mrdlam87/pitchd-app

---

## Current Stage
**Phase 5 — Build & ship. M2 (Campsite Data Pipeline) in progress.**

---

## What's been built (M1 + M2 start)

### M1 — Foundation ✅
- Next.js (App Router) + Tailwind CSS scaffold
- Prisma ORM + Supabase (PostgreSQL) configured
- Auth.js + Google OAuth — closed beta, role-based access (`admin` | `beta` | `user`)
- Protected routes — unauthenticated users redirected to sign-in
- Deployed to Vercel with all environment variables configured
- CI: lint + build checks on every PR; Claude code review posts as `claude[bot]`

### M2 — Campsite Data Pipeline (in progress)
- Prisma schema written for all data models: `Campsite`, `AmenityType`, `CampsiteAmenity`, `AmenityPOI`, `WeatherCache`, `SearchCache`, `User` (#18)
- `AmenityType` lookup table seeded with 8 records (#19):
  - Activities: `dog_friendly`, `fishing`, `hiking`, `swimming`
  - POIs: `dump_point`, `water_fill`, `laundromat`, `toilets`
- **Still to do:** OSM ingestion script (Overpass API → Postgres) to seed campsite data

---

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| Auth | Auth.js (NextAuth) + Google OAuth |
| AI | Anthropic Claude API (Haiku for MVP) |
| Weather | Open-Meteo (free, no API key) |
| Database | PostgreSQL via Prisma ORM |
| Hosted DB | Supabase |
| Map | Mapbox (tentative) |
| Deployment | Vercel |

---

## Key conventions (always follow these)
- TypeScript throughout
- Tailwind utility classes only — no custom CSS
- Prisma for all DB interactions — no raw SQL
- Next.js App Router (not Pages Router)
- Prefer server components; use client components only when needed
- All API routes in `/app/api/`
- Claude Haiku for all AI features — never Sonnet or Opus
- All routes are protected — user must be authenticated

---

## Milestones overview
| Milestone | Status |
|---|---|
| M1 — Foundation | ✅ Complete |
| M2 — Campsite data pipeline | 🔄 In progress |
| M3 — Map & browse mode | Not started |
| M4 — Filters & amenities | Not started |
| M5 — AI search | Not started |
| M6 — Weather | Not started |
| M7 — Polish & beta launch | Not started |

---

## Full project context
- `docs/project-context.md` — personas, MVP features, market research, design decisions, session log
- `docs/technical/technical-design.md` — architecture, data models, API routes, milestones
- `docs/ux-session-1.md` — UX decisions from prototype phase
- `prototypes/pitchd-light-v2.jsx` — reference UI implementation (design source of truth)

---

## How to continue
Say something like:
> *"I've read the handoff note. Let's continue M2 — build the OSM ingestion script to seed campsite data from Overpass API into Postgres."*
