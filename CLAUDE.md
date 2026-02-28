# CLAUDE.md — Pitchd
> This file is automatically read by Claude Code at the start of every session. It provides project context, conventions, and guidance for AI-assisted development.

---

## Project Overview
**Pitchd** is a map-first web app for Australian campers — "Google Maps for campers." Users can discover campsites, essential road amenities (dump points, public toilets, laundromats, water fill stations), and nearby activities (hikes, fishing spots, swimming holes) all in one place.

**Target market:** Australian campers (primary)  
**Current stage:** Pre-development — design & architecture phase

---

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Hosted DB | Supabase |
| Deployment | Vercel |
| Version Control | GitHub |

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
- **Supabase** — managed Postgres with a free tier, no vendor lock-in (standard Postgres underneath)
- **Vercel** — native Next.js integration, auto CI/CD from GitHub pushes
- **Australia-first** — scoped to AU data sources initially, architecture should allow future expansion

---

## Data Sources (to be confirmed in architecture phase)
- OpenStreetMap — dump points, public toilets, water facilities, trails
- Australian national/state park APIs (TBD)
- Potentially community-submitted data (post-MVP)

---

## Current Phase
See `docs/project-context.md` for full planning detail and current phase status.