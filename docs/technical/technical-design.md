# Pitchd — Technical Design
> This is a living document. Update as decisions are made and refined.

---

## 1. Architecture Overview

Pitchd is a Next.js full-stack web app. The frontend and backend live in one repository, deployed to Vercel. All AI, weather, and search logic runs server-side in Next.js API routes — never exposed to the client.

```
Browser
└── Next.js (Vercel)
    ├── App Router (React Server Components)
    ├── API Routes
    │   ├── /api/search       ← NL query → Claude → campsite results + weather
    │   ├── /api/campsites    ← browse mode, filter queries
    │   ├── /api/amenities    ← standalone POI queries (dump points etc.)
    │   └── /api/weather      ← weather fetch/cache for a given lat/lng
    └── Postgres (Supabase)
        ├── Campsite data (ingested from OSM + enriched)
        └── User, cache, and amenity tables
```

**Key principle:** The map is a display surface. All data fetching and AI logic happens server-side. The client receives results and renders them.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS | Unified frontend/backend, server components |
| Backend | Next.js API Routes | No separate server needed for MVP |
| Auth | Auth.js (NextAuth) + Google OAuth | No passwords stored, one-click sign in |
| AI | Anthropic Claude API (Haiku for MVP) | NL search interpretation, cost-effective |
| Weather | Open-Meteo | Free, no API key, good AU coverage |
| Database | PostgreSQL + Prisma ORM | Battle-tested, type-safe, approachable |
| Hosted DB | Supabase | Managed Postgres, generous free tier |
| Map | Mapbox | Polished tiles, customisable styles, confirmed and in use |
| Deployment | Vercel | Native Next.js integration, preview deployments |
| Data Sources | OpenStreetMap, data.gov.au, state park APIs | Free, open AU camping data |

---

## 3. Auth Strategy

- Auth required from day one — map tiles and AI queries cost money
- **Google OAuth via Auth.js** — no passwords stored, one-click sign in
- MVP launches in **closed/invite-only mode** — access controlled via `role` field
  - `admin` — full access (founder)
  - `beta` — invited test users
  - `user` — reserved for public launch
- Rate limiting and pricing tiers added when app opens publicly

---

## 4. Data Models

### Campsite
```
id             String   @id @default(cuid())
name           String
slug           String   @unique
lat            Float
lng            Float
state          String               // e.g. "NSW"
region         String?              // e.g. "Blue Mountains"
blurb          String?
bookingRequired Boolean @default(false)
bookingUrl     String?
source         String               // "osm" | "data.gov.au" | "manual"
sourceId       String?              // external ID for deduplication
lastSyncedAt   DateTime?
syncStatus     String   @default("active")  // "active" | "unverified" | "removed"
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
amenities      CampsiteAmenity[]
```

### AmenityType
Lookup table — adding a new filter is a new row, no schema change.
```
id        String  @id @default(cuid())
key       String  @unique   // e.g. "dog_friendly" | "fishing" | "dump_point"
label     String            // e.g. "Dog friendly"
icon      String            // emoji or icon key
color     String            // hex
category  String            // "activity" | "poi"
```

### CampsiteAmenity
Join table between Campsite and AmenityType.
```
campsiteId    String
amenityTypeId String
@@id([campsiteId, amenityTypeId])
```

### AmenityPOI
Standalone POIs shown as separate pins on the map (dump points, water fills etc.)
```
id            String   @id @default(cuid())
name          String?
lat           Float
lng           Float
amenityTypeId String
source        String
sourceId      String?
verified      Boolean  @default(false)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
```

### WeatherCache
```
id          String   @id @default(cuid())
lat         Float
lng         Float
fetchedAt   DateTime
expiresAt   DateTime
forecastJson Json
```

### SearchCache
```
id              String   @id @default(cuid())
queryHash       String   @unique
queryText       String
parsedIntentJson Json
createdAt       DateTime @default(now())
expiresAt       DateTime
```

### User
```
id          String   @id @default(cuid())
email       String   @unique
name        String?
avatarUrl   String?
googleId    String   @unique
role        String   @default("user")   // "admin" | "beta" | "user"
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```

### MVP Filter Options
- **Activities** (→ CampsiteAmenity): dog friendly, fishing, hiking, swimming
- **POIs** (→ AmenityPOI): dump points, water fill, laundromat, toilets
- Filter list will grow over time — join table design means no schema changes required
- **Weather** is computed at query time from Open-Meteo, not stored as an amenity

---

## 5. Campsite Data Strategy

**Primary source:** OpenStreetMap via Overpass API

OSM research findings (NSW sample, March 2026):
- ~7,875 campsites returned for NSW alone — full AU will be significantly more
- 87% have a name, good lat/lng coverage
- Amenity tags are sparse: `toilets` 26%, `dog` only 1%, `drinking_water` 3%
- OSM is reliable for **location data**, not for **amenity detail**

**Enrichment strategy:**
1. OSM as the base layer (location, name, basic info)
2. State park agency data for national/state park sites (NPWS, Parks Victoria, QLD Parks, DBCA etc.)
3. Manual curation for high-traffic sites with missing amenity data
4. User contributions as a long-term data quality strategy (Phase 2)

**Sync approach:**
- Scheduled scraper/sync job (weekly) to pull fresh OSM data
- Upsert against existing DB records by `sourceId` or lat/lng proximity
- `lastSyncedAt` and `syncStatus` on Campsite track data freshness
- Scraper runs via GitHub Actions (free) or triggered manually at first

---

## 6. Navigation

Every campsite and AmenityPOI has a Navigate button. No Google Maps SDK or API key required — just a URL:

```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
```

Opens Google Maps (or the app if installed) with directions to that coordinate on any device.

---

## 7. AI Strategy

- **Model:** Claude Haiku for all MVP AI features — cheaper than Sonnet/Opus, fully capable for NL search interpretation
- **Cache responses** — identical/similar queries return cached results (`SearchCache`)
- **Hybrid search** — use traditional DB filters for simple queries, only invoke Claude for genuine natural language input
- **Pre-generate where possible** — future AI summaries run as batch jobs, stored in DB (Phase 2)
- **Monitor from day one** — cost alerts set up in Anthropic Console

**AI feature rollout:**
- MVP: Natural language search, weather-aware results, Pitchd pick
- Phase 2: AI campsite summaries, trip planner, smart recommendations, Pitchd pick personalisation

---

## 8. Caching Strategy

| Cache | TTL | Reason |
|---|---|---|
| `SearchCache` | 2 hours | Campsite data is stable, weather within results refreshes separately |
| `WeatherCache` | 1 hour | Open-Meteo updates forecasts a few times per day |

Both caches use `expiresAt` on the DB record — expired records are treated as a miss and re-fetched. No separate cache infrastructure needed for MVP (no Redis etc.).

---

## 9. Weather Fetching Strategy

- Source: Open-Meteo (free, no API key, good AU coverage)
- Browse mode: fetch weather only for pins in current viewport, re-fetch on map pan
- Zoom level determines granularity: zoomed out = area-level, zoomed in = individual pin
- Cache responses in `WeatherCache` to avoid redundant fetches

---

## 10. API Routes

All routes are protected — user must be authenticated.

### `POST /api/search`
NL query → Claude → ranked campsite results.
- Checks `SearchCache` first, calls Claude Haiku on miss
- Runs DB query filtered by parsed intent
- Body: `{ query, lat, lng }`
- Returns: `{ campsites[], parsedIntent }`

### `GET /api/campsites`
Browse mode — no AI, straight DB query.
- Params: `lat, lng, radius, amenities[], page`
- Returns: `campsite[]`

### `GET /api/campsites/[id]`
Single campsite with amenities.
- Returns: `campsite + amenities[]`

### `GET /api/amenities`
Standalone POI pins for current viewport.
- Params: `lat, lng, radius, type`
- Returns: `AmenityPOI[]`

### `GET /api/weather`
Weather for a given coordinate.
- Checks `WeatherCache` first, fetches from Open-Meteo on miss
- Params: `lat, lng`
- Returns: `forecastJson`

### `/api/auth/[...nextauth]`
Handled automatically by Auth.js — no custom implementation needed.

---

## 11. Development Milestones

Each milestone produces a usable, evolving product. AI search is introduced at M5 — early enough to test the core experience before weather is layered on.

### M1 — Project foundation
- Next.js app scaffold with App Router + Tailwind
- Prisma + Supabase connection
- Auth.js + Google OAuth
- Protected routes (beta/admin only)
- Basic deploy to Vercel

**End state:** App boots, you can log in.

---

### M2 — Campsite data pipeline
- Prisma schema + migrations (all models)
- AmenityType seed data
- OSM ingestion script (Overpass API → Postgres)
- AU campsite data seeded into DB

**End state:** Data is in the DB.

---

### M3 — Map & browse mode
- Mapbox integration
- Campsite pins rendered from DB
- User device location
- Viewport-based data fetching
- Navigate button (Google Maps URL)

**End state:** Pins on a map, can navigate to a site.

---

### M4 — Filters & amenities
- Filter panel wired to DB queries
- AmenityPOI pins on map
- Filter state synced with results
- Drawer with campsite cards

**End state:** Filters work, browse mode is functional.

---

### M5 — AI search
- Claude Haiku integration
- NL query parsing (intent, location, filters, dates)
- Search results ranked by intent
- SearchCache (avoid repeat API calls)
- Pitchd pick

**End state:** AI search works, Pitchd pick works — core Pitchd experience is live.

---

### M6 — Weather integration
- Open-Meteo integration
- Weather day columns on campsite cards (strip + day cells)
- WeatherCache
- Weather-aware result ranking
- Viewport-based weather fetching

**End state:** Weather-aware results — full MVP feature set complete. Note: weather badge pill was built then removed; cards use weather day columns instead. Coloured map pins by weather score deferred to M7.

---

### M7 — Polish & beta launch
- Full drawer UI + card design matching prototype
- Loading states, empty states, error handling
- Mobile QA
- Invite first beta users

**End state:** Beta-ready, real users on the app.
