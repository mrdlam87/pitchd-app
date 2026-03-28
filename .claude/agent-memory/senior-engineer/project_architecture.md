---
name: Pitchd codebase architecture
description: Key architectural patterns, non-obvious decisions, performance gotchas, and schema facts for the Pitchd production app
type: project
---

## Repository layout
The production Next.js app lives in `/app/` — NOT the repo root. All imports use path alias `@/` which resolves to the `app/` subdirectory. Key paths:
- API routes: `app/api/<route>/route.ts`
- Pages: `app/<page>/page.tsx`
- Components: `components/`
- Lib: `lib/`
- Prisma schema: `prisma/schema.prisma`

## Prisma
- Uses `@prisma/adapter-pg` (not the default connector) — serverless-compatible pg adapter
- Connection pool max=1 intentionally to prevent Supabase connection exhaustion
- TODO in codebase: switch to Supabase transaction-mode URL (port 6543) — tracked in GH issue #115

## Index design (as-built)
- `Campsite`: `@@index([syncStatus, lat, lng])` — Postgres B-tree can range-scan on syncStatus+lat but NOT on lng (second range column limitation)
- `AmenityPOI`: `@@index([amenityTypeId, lat, lng])`
- `WeatherCache`: `@@unique([lat, lng])`
- `SearchCache`: `@@unique([queryHash])`
- No index on `SearchCache.expiresAt` — full scan for TTL cleanup if ever needed
- No index on `WeatherCache.expiresAt` — same

## Map.tsx — the large file (~1150 lines)
- Entirely client component — "use client" at top
- Uses many useRef mirrors of state (activeFiltersRef, drawerStateRef, etc.) to give stable callbacks current values without re-creating them
- pLimit implemented locally in both weatherRanking.ts and weather/batch/route.ts — duplicated utility
- extractWeatherForecast also duplicated between Map.tsx (client) and weatherRanking.ts (server) — intentional different defaults (4 days vs 2-day ranking window)
- selectPin has `[campsites]` as dependency — recreated on every campsite state change

## Auth flow
- Two auth configs: `auth.config.ts` (edge-compatible, no Prisma, for middleware) and `auth.ts` (full, Prisma callbacks, for API routes)
- JWT callback queries DB on every token refresh — no caching of role within JWT lifespan
- signIn callback upserts user; jwt callback does a second findUnique — two DB queries per sign-in

## Caching architecture
- SearchCache: SHA256(lowercase.trim(query)) → ParsedIntent JSON, 2h TTL, DB-backed
- WeatherCache: unique(lat,lng) → Open-Meteo JSON, 1h TTL, DB-backed
- Client weather cache: Map<campsiteId, WeatherDay[]> in weatherCacheRef — session-scoped, never persisted
- No TTL cleanup job — expired records accumulate in DB, treated as misses on read

## Weather fetching
- weatherRanking.ts fetches 16 forecast days from Open-Meteo (forecast_days=16)
- weather/batch/route.ts and weather/route.ts fetch 7 days (forecast_days=7)
- Inconsistency: /api/weather/batch caches 7-day data; weatherRanking fetches 16-day data and caches it under the same key — a subsequent batch fetch will find the 7-day entry in cache and overwrite with less data, or vice versa depending on order

## Security
- Prompt injection: angle brackets escaped in parseIntent.ts before inserting user query into prompt
- API auth: all routes guarded via requireAuth() in apiAuth.ts
- No per-user rate limiting on /api/search yet (TODO comment in code)
- PREVIEW_BYPASS_AUTH bypasses auth but not role checks — by design

## Known TODOs in code
- ResizeObserver for BottomDrawer FULL_STATE_SPACER_PX (hardcoded 120px)
- Per-user rate limiting on /api/search before wider launch
- Switch DATABASE_URL to Supabase transaction-mode URL (port 6543) — GH issue #115
- filterCount badge counts pois + activities but only activities filter campsites (pois filter AmenityPOIs separately) — labeled TODO M4

**Why:** Architectural snapshot recorded after full codebase review on 2026-03-28.
**How to apply:** Use as a reference when making changes — these facts are not obvious from reading individual files.
