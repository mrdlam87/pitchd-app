# Pitchd — System Architecture Reference
> How the system is actually built. Updated as implementation evolves.
> For original technical design decisions and milestones, see `technical-design.md`.

---

## 1. Repository Layout

```
pitchd-app/
├── app/                        ← Next.js app (App Router)
│   ├── app/                    ← Pages and API routes
│   │   ├── page.tsx            ← Root redirect → /app
│   │   ├── app/
│   │   │   ├── page.tsx        ← HomeScreen (NL search entry)
│   │   │   └── map/page.tsx    ← MapView (map + drawer)
│   │   ├── api/
│   │   │   ├── search/         ← POST /api/search
│   │   │   ├── campsites/      ← GET /api/campsites, GET /api/campsites/[id]
│   │   │   ├── amenities/      ← GET /api/amenities
│   │   │   ├── weather/        ← GET /api/weather, POST /api/weather/batch
│   │   │   └── health/         ← GET /api/health
│   │   ├── sign-in/            ← Auth landing page
│   │   └── access-denied/      ← Role gate page
│   ├── components/             ← UI components
│   │   ├── HomeScreen.tsx      ← Search input, chips, geolocation
│   │   ├── Map.tsx             ← Mapbox map, pins, weather, search/browse modes
│   │   ├── BottomDrawer.tsx    ← Drawer state machine, campsite cards, POI cards
│   │   └── FilterPanel.tsx     ← Full-screen filter overlay
│   ├── lib/                    ← Shared utilities
│   │   ├── prisma.ts           ← Prisma singleton (pool=1 for serverless)
│   │   ├── parseIntent.ts      ← Claude Haiku NL parsing
│   │   ├── searchCache.ts      ← SearchCache read/write
│   │   ├── searchResults.ts    ← sessionStorage payload types + parser
│   │   ├── weatherRanking.ts   ← Weather fetch, scoring, combined ranking
│   │   ├── weatherScore.ts     ← WMO-to-score mapping, badge labels
│   │   ├── distance.ts         ← Haversine formula
│   │   ├── apiAuth.ts          ← Auth enforcement helper for API routes
│   │   ├── chips.ts            ← Quick chip definitions + allowed filter lists
│   │   └── tokens.ts           ← Design token constants (colours)
│   ├── prisma/
│   │   └── schema.prisma       ← Data models
│   ├── types/
│   │   ├── map.ts              ← Campsite, AmenityPOI, WeatherDay types
│   │   └── next-auth.d.ts      ← Session + JWT type augmentation
│   ├── auth.ts                 ← Auth.js full config (with Prisma callbacks)
│   ├── auth.config.ts          ← Edge-compatible auth config (for middleware)
│   └── middleware.ts           ← Route protection + preview bypass
├── prototypes/                 ← Vite + React design prototype (not production)
└── docs/                       ← Project documentation
```

---

## 2. Component Responsibilities

### HomeScreen (`components/HomeScreen.tsx`)
Single-page search entry point. Owns:
- NL query input (textarea with cycling placeholder prompts every 3.2s)
- Two search paths:
  - **AI search** (`handleSearch`): POSTs to `/api/search`, wraps response as `AISearchPayload`, writes to `sessionStorage`, navigates to `/map`
  - **Direct filter** (`handleDirectFilter`): Chip with `filterKey` → writes `DirectFilterPayload`, navigates to `/map` without an API call
- Geolocation: 5-second timeout, silent fallback to Sydney (-33.87, 151.21)
- Quick filter chips (from `lib/chips.ts`)

### Map (`components/Map.tsx`)
The largest component (~52K). Owns everything on the map screen:
- **Two modes:** search results (from sessionStorage payload) and browse (viewport DB queries)
- Mapbox GL via `react-map-gl`, `outdoors-v12` style
- Campsite and amenity pin rendering + selection
- Camera management (flyTo on load, easeTo on pin select)
- Viewport-based campsite and weather fetching (on `moveend`)
- Client-side weather cache (`weatherCacheRef`)
- Inline search (re-query without leaving map)
- Drawer state coordination (opens to half on pin select)

**Mode switching:**
- Entering search mode: sessionStorage payload loaded on mount, or `handleMapSearch()` called inline
- Exiting search mode: `handleClearSearch()` — clears AI-inferred filters, re-fetches browse results

### BottomDrawer (`components/BottomDrawer.tsx`)
Drawer state machine + card list:
- Three snap positions: `peek` (64px), `half` (52vh), `full` (100dvh)
- Touch drag via native (non-React) `touchmove` listener on the handle strip (40px threshold to snap)
- CSS `transform` during drag (no transition); transition re-enabled on `touchEnd`
- Static 120px spacer in full state to clear search bar — **TODO: replace with ResizeObserver**
- Renders `CampsiteCard` (compact in peek, full in half/full) and `POICard`

### FilterPanel (`components/FilterPanel.tsx`)
Full-screen overlay (z-200):
- Activities: dog_friendly, fishing, hiking, swimming
- POIs: dump_point, water_fill, laundromat, toilets
- Date range picker: 7-day grid, smart start/end logic
- Chips marked "Pitchd" badge if value was AI-inferred
- "Search with these filters" CTA calls back to Map for re-fetch

---

## 3. API Routes

### `POST /api/search`
NL query → Claude Haiku → ranked campsites with weather.

**Request:**
```typescript
{ query: string; lat: number; lng: number; startDate?: string; endDate?: string }
```

**Response:**
```typescript
{ campsites: Campsite[]; parsedIntent: ParsedIntent }
```

**Pipeline:**
1. Validate input (query ≤500 chars; lat/lng within range; reject ±90° lat — `cos(90°)=0` causes divide-by-zero in bounding box)
2. Hash query → check `SearchCache` (2-hour TTL)
3. On miss: call `parseIntentWithClaude()` → cache result
4. If `parsedIntent.location` is set: geocode via Nominatim (OSM) → lat/lng; else use user GPS
5. Compute radius = `driveTimeHrs * 80 km/h` (max 12 hrs = 960 km)
6. Build bounding box with longitude convergence correction: `Δlng = radius / (111.32 * cos(lat))`
7. Prisma query: `syncStatus=active`, lat/lng in bounds, optional amenity join filter; fetch up to 200 rows
8. Sort by Haversine distance, take top 50 proximity candidates
9. Batch weather fetch via `fetchWeatherForCandidates()` (8-second total timeout; partial results on timeout)
10. Combine scores: **proximity 60% + weather 40%**
11. Return top 20 by combined score + parsedIntent

**Key limits:** 200 DB rows max, 50 weather candidates, 20 final results.

---

### `GET /api/campsites`
Browse mode — exact viewport bounding box query.

**Params:** `north, south, east, west, page, amenities[]`

**Response:** `{ results: Campsite[]; page; pageSize: 20; hasMore: boolean }`

**Guards:** `MAX_LAT_SPAN=10°`, `MAX_LNG_SPAN=15°` — prevents full-table scans on large viewports.
**Pagination:** Fetches PAGE_SIZE+1 to detect `hasMore` without a COUNT query.
**Order:** `name asc, id asc` for deterministic pagination.

---

### `GET /api/amenities`
Standalone POI pins near a coordinate.

**Params:** `lat, lng, radius (max 500km), type`

**Response:** `{ results: AmenityPOI[]; truncated: boolean }`

Uses a square bounding box (not a true circle). Corners are ~41% outside the radius — acceptable for opportunistic POI discovery. Max 200 results.

---

### `GET /api/weather`
Single coordinate forecast.

**Params:** `lat, lng`

**Response:** `{ forecastJson: object }`

Checks `WeatherCache` first (1-hour TTL, unique on `[lat, lng]`). On miss, fetches from Open-Meteo with 10-second timeout. Returns 502 if Open-Meteo fails.

---

### `POST /api/weather/batch`
Bulk weather fetch for up to 100 coordinates.

**Request:** `{ locations: Array<{ id, lat, lng }> }`

**Response:** `{ results: Record<id, forecastJson | null> }`

Deduplicates by `id`, batch-checks cache, fetches misses in parallel (concurrency=10). Per-location failures return `null` — batch never fails entirely.

---

### `GET /api/health`
Liveness check. No auth required. Returns 503 if DB unreachable.

---

## 4. Data Models

### Campsite
```
id             CUID (PK)
name           String
slug           String (unique)
lat / lng      Float
state          String          // "NSW", "VIC", etc.
region         String?         // "Blue Mountains"
blurb          String?
bookingRequired Boolean
bookingUrl     String?
source         String          // "osm" | "data.gov.au" | "manual" | "test"
sourceId       String?
syncStatus     Enum            // active | unverified | removed
lastSyncedAt   DateTime?
amenities      CampsiteAmenity[]

@@unique([source, sourceId])
@@index([syncStatus, lat, lng])
```

### AmenityType (lookup table)
```
id       CUID
key      String (unique)   // "dog_friendly" | "fishing" | "dump_point" | etc.
label    String
icon     String
color    String
category String            // "activity" | "poi"
```
**Seeded values:** dog_friendly, fishing, hiking, swimming (activities); dump_point, water_fill, laundromat, toilets (POIs).

### CampsiteAmenity (join table)
```
campsiteId    → Campsite
amenityTypeId → AmenityType
@@id([campsiteId, amenityTypeId])
```
**Currently empty** — amenity links populated in M4 data pipeline.

### AmenityPOI
```
id            CUID
name          String?
lat / lng     Float
amenityTypeId → AmenityType
source        String
sourceId      String?
verified      Boolean

@@unique([source, sourceId])
@@index([amenityTypeId, lat, lng])
```

### WeatherCache
```
id          CUID
lat / lng   Float
fetchedAt   DateTime
expiresAt   DateTime
forecastJson Json         // Raw Open-Meteo JSON

@@unique([lat, lng])
```

### SearchCache
```
id              CUID
queryHash       String (unique)   // SHA256 of normalised query
queryText       String
parsedIntentJson Json
createdAt       DateTime
expiresAt       DateTime          // 2-hour TTL
```

### User
```
id         CUID
email      String (unique)
name       String?
avatarUrl  String?
googleId   String (unique)
role       Enum              // admin | beta | user
```

---

## 5. Auth

**Provider:** Google OAuth only (no passwords).

**Session shape:**
```typescript
session.user = {
  id: string;       // DB User.id
  role: UserRole;   // "admin" | "beta" | "user"
  name, email, image  // from Google
}
```

**Flow:**
1. `signIn` callback: upserts `User` record on first Google sign-in
2. `jwt` callback: attaches `userId` + `role` to JWT from DB lookup
3. `session` callback: copies `userId` + `role` into `session.user`

**Route protection (middleware.ts):**
- Public: `/api/auth/*`, `/sign-in`, `/access-denied`
- `role=user` → redirect to `/access-denied` (not yet invited to beta)
- All other routes require `admin` or `beta`
- Preview bypass: `PREVIEW_BYPASS_AUTH=true` + `VERCEL_ENV !== "production"` bypasses auth (not role checks)

**API route enforcement (`lib/apiAuth.ts`):**
```typescript
const authError = await requireAuth();          // any authenticated user
const authError = await requireAuth("admin");   // admin only
if (authError) return authError;               // returns 401 or 403 Response
```

**Two auth configs:**
- `auth.config.ts` — edge-compatible (no Prisma), used by middleware
- `auth.ts` — full config with Prisma callbacks, used by API routes

---

## 6. Key Data Flows

### Search flow (NL query)
```
HomeScreen
  → geolocation (5s timeout, fallback Sydney)
  → POST /api/search { query, lat, lng }
      → hash query → SearchCache lookup
      → [miss] parseIntentWithClaude() → cache
      → [location set] Nominatim geocode
      → Prisma bounding box query (max 200)
      → Haversine sort → top 50
      → fetchWeatherForCandidates() [8s timeout, partial ok]
      → combinedScore() [60% proximity + 40% weather]
      → return top 20 + parsedIntent
  → write AISearchPayload to sessionStorage
  → router.push("/map")

MapView (mount)
  → read sessionStorage → parseSearchResultsPayload()
  → fitToCampsites() [Mapbox fitBounds]
  → render pins + drawer in search mode
```

### Direct filter flow (chip without AI)
```
HomeScreen
  → chip with filterKey tapped
  → write DirectFilterPayload { filters: { activities, pois }, chipKey }
  → router.push("/map")

MapView (mount)
  → reads DirectFilterPayload
  → GET /api/campsites?amenities=dog_friendly (no AI, no weather pre-fetched)
  → render pins in browse mode
  → POST /api/weather/batch for visible pins
```

### Browse mode flow
```
MapView
  → user location fly-to on mount
  → loadCampsites() on moveend
      → GET /api/campsites?north=&south=&east=&west=&page=1
  → loadWeatherForViewport()
      → POST /api/weather/batch [uncached pins only]
      → merge weather into campsite state
  → re-render pins + drawer
```

### Pin select flow
```
User taps pin
  → selectPin(index) or selectPoi(poi)
  → map.easeTo({ center: pin, padding: { bottom: drawerHalfHeight } })
  → setDrawerState("half") if currently "peek"
  → cardRefs[index].scrollIntoView() [after DRAWER_TRANSITION_MS delay if animating]
  → pin gets selected visual state (coral outline, larger)
```

---

## 7. Caching Architecture

| Cache | Layer | Key | TTL | Notes |
|---|---|---|---|---|
| `SearchCache` | DB (Postgres) | SHA256 of normalised query | 2 hours | Stores Claude's ParsedIntent; re-sanitised on read |
| `WeatherCache` | DB (Postgres) | `[lat, lng]` composite | 1 hour | Raw Open-Meteo JSON; same coordinate reused across searches |
| Client weather | In-memory (Map.tsx ref) | campsite id | Session | `weatherCacheRef` — avoids re-fetching on pan back |

**Cascade:** Client cache → DB cache → Open-Meteo API.

**Serverless caveat:** Vercel may send the response before background Prisma writes complete. A cache write failure means the next request re-fetches — degraded performance, not data loss.

---

## 8. Weather Scoring

**Per-day penalty** (`weatherScore.ts`):
- WMO code 0–2 (clear/cloudy): 0 penalty
- WMO code 3 (overcast): 5
- WMO code 51–67 (drizzle/rain): 20–30
- WMO code 71–77 (snow): 25–35
- WMO code 80–82 (showers): 20–30
- WMO code 95–99 (thunderstorm): 40
- Precipitation >5mm adds 10; >15mm adds 20

**Score = 100 − average daily penalty** (floor 0).

**Badges:** Great ≥75 (green), Good ≥45 (amber), Poor <45 (coral).

**Intentional design:** Averaging across days means longer trips score higher for the same bad-weather days — reflects camping reality (one rainy day in 4 is fine).

**Weather signal on map:** Pins will be colour-coded by weather score (M7). Cards show weather day columns (strip + per-day cells). No separate badge pill on cards — removed as redundant with day columns.

---

## 9. Search Results Payload (sessionStorage)

Two payload types passed between HomeScreen and MapView via `sessionStorage["pitchd:searchResults"]`:

```typescript
// AI search result
AISearchPayload {
  kind: "ai"
  campsites: Campsite[]       // with weather attached
  parsedIntent: ParsedIntent
  query: string
  chipKey?: string
}

// Direct chip filter (no AI)
DirectFilterPayload {
  kind: "direct"
  filters: { activities: string[], pois: string[] }
  chipKey: string
}
```

`parseSearchResultsPayload()` validates and discriminates on `kind`. MapView branches on payload type for render logic.

---

## 10. Non-Obvious Gotchas

**Latitude ±90 rejection** — `cos(±π/2) ≈ 0`, which causes infinite longitude delta in the bounding box calculation. Any lat/lng at the poles is explicitly rejected in `/api/search` input validation.

**`0` is a valid coordinate** — validation uses `Number(x || NaN)` not `parseFloat()` or `|| 0`, since `0` is falsy but valid (e.g., lng=0 is the prime meridian).

**CampsiteAmenity is empty** — the join table has no rows until M4 data pipeline runs. Any search with amenity filters returns zero results until this is populated. This is expected — do not interpret empty results as a bug before M4.

**Drive time underestimates** — `radius = driveTimeHrs * 80 km/h` uses highway speed. Australian camping roads (Blue Mountains, Snowy Mountains, coastal hinterlands) are typically 60 km/h or slower. Results near the edge of the radius may be further away than the drive time implies.

**Weather timeout racing** — `fetchWeatherForCandidates()` races against an 8-second timeout. On timeout, a snapshot of partial results is returned. Background fetches may continue and write to cache, but those results are not returned to the caller.

**Static drawer spacer** — `BottomDrawer.tsx` uses a hardcoded 120px spacer in full state to clear the search bar. If the search bar or chip row grows (e.g., chip row wraps), content will be obscured. A ResizeObserver-based dynamic spacer is needed — there is a TODO in the code.

**Preview bypass scope** — `PREVIEW_BYPASS_AUTH=true` bypasses auth checks but not role checks. A route calling `requireAuth("admin")` will still return 403 on a preview deploy unless the user is actually an admin.

**Nominatim rate limit** — OSM's Nominatim geocoder is rate-limited to 1 req/s. This is only called on `SearchCache` miss, so at beta scale (low volume, cached queries) it's fine. If cache misses spike, Nominatim calls could back up.

**sessionStorage quota** — sessionStorage write is wrapped in try/catch; on quota exceeded, the write is silently skipped and MapView falls back to browse mode. This is unlikely but handled gracefully.

---

## 11. Environment Variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.ts` | Use Supabase transaction mode URL (port 6543) for serverless — prevents connection exhaustion |
| `AUTH_SECRET` | Auth.js | 32+ byte random secret |
| `AUTH_GOOGLE_ID` | Auth.js | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Auth.js | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | `lib/parseIntent.ts` | Lazy-initialised at first request |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `components/Map.tsx` | Public token; logged to console if missing |
| `PREVIEW_BYPASS_AUTH` | `middleware.ts`, `lib/apiAuth.ts` | `"true"` bypasses auth on non-production Vercel deployments |
| `VERCEL_ENV` | `middleware.ts`, `lib/apiAuth.ts` | Set automatically by Vercel: `"production"` \| `"preview"` \| `"development"` |

---

## 12. Prisma Connection Pool

**Config (`lib/prisma.ts`):**
```typescript
max: 1                        // one connection per serverless instance
connectionTimeoutMillis: 5000
idleTimeoutMillis: 10000
```

`max=1` prevents Supabase connection pool exhaustion on serverless (each Vercel function instance holds one connection). The long-term fix is using Supabase's **transaction mode pooler URL** (`postgres://...@pooler.supabase.com:6543/...`), which terminates connections after each transaction rather than holding them open.

---

*For planned architecture and milestone definitions, see `technical-design.md`.*
*For UX decisions and interaction patterns, see `ux-session-1.md`.*
