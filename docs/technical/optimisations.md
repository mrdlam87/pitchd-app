# Pitchd Optimisation Backlog
**Reviewed:** 2026-03-28 | **Scope:** M1–M6 production code, pre-M7 beta launch

---

## High Priority — fix before beta launch

- [ ] **#1 — Outer timeout on `/api/search`**
  - **File:** `app/app/api/search/route.ts`
  - **Problem:** Cumulative worst-case pipeline (geocode 5s + Claude 10s + weather 8s = 23s) exceeds Vercel's 15s function limit. Client receives a mystery timeout with no error message.
  - **Fix:** Wrap the entire POST handler body in a `Promise.race` against a 12s hard ceiling, returning a `504` with a user-friendly message. Ensure individual step timeouts sum to less than Vercel's configured function limit.

- [ ] **#2 — Rate limiting on `/api/search`**
  - **File:** `app/app/api/search/route.ts:121` (TODO comment already exists)
  - **Problem:** A single authenticated user can hammer the endpoint, burning Anthropic API credits and Nominatim quota with no guard.
  - **Fix:** Implement per-user rate limiting. Options in order of complexity: (1) in-memory per-userId counter — simple but not shared across serverless instances; (2) Vercel KV / Upstash Redis for cross-instance limiting; (3) Vercel Edge middleware rate limiting (simplest for this stack).

- [ ] **#3 — Campsite bounding-box index can't range-scan `lng`**
  - **File:** `prisma/schema.prisma:42`
  - **Problem:** The compound index `@@index([syncStatus, lat, lng])` is a B-tree. Postgres can range-scan the `lat` column after the `syncStatus` equality prefix, but cannot use `lng` as a second range filter. The `lng` column is applied as a heap re-check only.
  - **Fix:** Add a partial B-tree index on `(lat, lng) WHERE syncStatus = 'active'` via a raw SQL migration (Prisma does not yet support partial index syntax natively).

---

## Medium Priority

- [ ] **#4 — Weather cache key collision (7-day vs 16-day fetch window)**
  - **Files:** `app/lib/weatherRanking.ts:153`, `app/app/api/weather/route.ts:64`, `app/app/api/weather/batch/route.ts:26`
  - **Problem:** `weatherRanking.ts` fetches 16 forecast days; browse routes fetch 7 days. Both write to `WeatherCache` keyed by `(lat, lng)` only. A browse-mode cache hit (7 days) can be served to the AI ranker expecting 16 days, silently truncating the ranking window. The reverse also occurs.
  - **Fix:** Standardise on 7 days across all paths. The ranking window should be driven by the user's requested date range, not the number of fetched days. If >7 days is ever needed, add a `window` discriminator to the cache key.

- [ ] **#5 — Role change requires sign-out to take effect**
  - **File:** `app/auth.ts:37–46`
  - **Problem:** Role is cached in the JWT at initial sign-in. Promoting a user from `user` to `beta` won't take effect until their JWT expires (default 30 days). This will cause confusion during the invite-only phase.
  - **Fix (option A):** Re-fetch role from DB on every JWT refresh (adds one DB read per token refresh). **(Option B):** Shorten JWT expiry to a few hours during the invite phase. **(Option C):** Document "user must sign out and back in after role promotion" explicitly in the admin runbook.

- [ ] **#6 — In-flight `/api/search` requests not cancellable**
  - **File:** `app/components/Map.tsx:697`
  - **Problem:** Rapid query submissions (or chip taps while a search is loading) can spawn concurrent POST requests that race. The later response may overwrite the earlier one, or vice versa. Amenity chips are not disabled during loading and can trigger this race.
  - **Fix:** Use an `AbortController` ref. Cancel the previous in-flight fetch before starting a new one. Apply the same stale-counter pattern already used for browse fetches (`fetchCounterRef`).

- [ ] **#7 — `handleMoveEnd` not debounced**
  - **File:** `app/components/Map.tsx:459–495`
  - **Problem:** Mapbox fires `moveend` after every animation frame completion during a pan. Each event triggers `loadCampsites` and `loadWeatherForViewport`, spawning many concurrent fetch chains during a long pan animation. The stale-discard pattern prevents wrong results but not redundant connections.
  - **Fix:** Debounce `handleMoveEnd` by 100–200ms.

- [ ] **#8 — `selectPin` recreated on every campsite state change**
  - **File:** `app/components/Map.tsx:640–668`
  - **Problem:** `selectPin` has `[campsites]` in its `useCallback` dependency array, causing a new function reference every time the campsite array updates (weather patches, browse reloads). All children receiving `onSelect` re-render unnecessarily.
  - **Fix:** Replace `campsites[i]` with `campsitesRef.current[i]` inside the callback. `campsitesRef` is a stable ref, so the dependency array becomes `[]`.

- [ ] **#9 — `sortBy` parsed by Claude but never applied in ranking**
  - **Files:** `app/lib/parseIntent.ts:25`, `app/app/api/search/route.ts:206–233`
  - **Problem:** Claude is prompted to extract `sortBy: "proximity" | "relevance" | null` on every search. The field is stored in `SearchCache` and returned to the client, but ranking always uses the same 60% proximity / 40% weather formula regardless of the value. It is dead weight consuming tokens every call.
  - **Fix (option A):** Implement `sortBy` in the ranking logic (e.g. when `"proximity"` → 100% proximity weight; when `"relevance"` → shift toward weather/amenity score). **(Option B):** Remove from the prompt and schema entirely to reduce token usage.

- [ ] **#10 — `ON DELETE RESTRICT` on `CampsiteAmenity` will block M4 sync deletions**
  - **File:** `prisma/migrations/.../migration.sql:126`
  - **Problem:** When the OSM sync pipeline needs to delete a stale `Campsite` row, it will fail if any `CampsiteAmenity` rows reference it. `CampsiteAmenity` is currently empty (M4 not complete), so this is not yet a problem — but will surface once M4 data is loaded.
  - **Fix:** Change `ON DELETE RESTRICT` to `ON DELETE CASCADE` for `CampsiteAmenity.campsiteId`. Add a new Prisma migration.

- [ ] **#11 — `WeatherCache findMany` selects all columns unnecessarily**
  - **File:** `app/app/api/weather/batch/route.ts:135`
  - **Problem:** The `findMany` call selects `SELECT *`, including the full `forecastJson` JSONB blob (~tens of KB/row) for every cache hit, even though only `lat`, `lng`, and `forecastJson` are used. For a batch of 50 candidates this can transfer several MB unnecessarily. (`weatherRanking.ts` already uses an explicit `select` correctly.)
  - **Fix:** Add `select: { lat: true, lng: true, forecastJson: true }` to the `findMany` call in `weather/batch/route.ts`.

---

## Low Priority

- [ ] **#12 — `Nunito` font loaded but never used**
  - **File:** `app/app/layout.tsx:3`
  - **Problem:** `Nunito` is imported, declared as `--font-nunito`, and added to `<body>` class, but no component references it. DM Sans and Lora are the only fonts used.
  - **Fix:** Remove the `Nunito` import and `nunito.variable` from the body class.

- [ ] **#13 — `pLimit` utility duplicated in two files**
  - **Files:** `app/app/api/weather/batch/route.ts:48`, `app/lib/weatherRanking.ts:173`
  - **Fix:** Extract to `app/lib/concurrency.ts` and import in both files.

- [ ] **#14 — `extractWeatherForecast` logic duplicated client/server with diverging implementations**
  - **Files:** `app/components/Map.tsx:78`, `app/lib/weatherRanking.ts:46`
  - **Problem:** Two implementations with different defaults (4 days for display vs today+tomorrow for ranking). Already diverging subtly (AEST date handling differs). If Open-Meteo changes its response shape, both must be updated.
  - **Fix:** Extract a shared `parseOpenMeteoForecast(forecast, from, to)` core function into a shared lib. Callers provide their own date window defaults.

- [ ] **#15 — No TTL cleanup job for stale `WeatherCache` / `SearchCache` rows**
  - **File:** `prisma/schema.prisma` (both cache models)
  - **Problem:** Expired rows accumulate indefinitely. No scheduled cleanup and no index on `expiresAt`. At beta scale this is fine; at AU scale with hourly weather refreshes, the table could accumulate hundreds of thousands of stale rows.
  - **Fix (short-term):** Add `@@index([expiresAt])` to both cache tables. **(Long-term):** Vercel cron job or Supabase `pg_cron` to run `DELETE FROM "WeatherCache" WHERE "expiresAt" < NOW()` weekly.

- [ ] **#16 — Float lat/lng cache key — precision noise risk**
  - **File:** `prisma/schema.prisma:91` (`@@unique([lat, lng])` on `WeatherCache`)
  - **Problem:** Two requests for `lat: -33.8688` vs `lat: -33.86880000001` (floating-point representation noise) generate separate cache entries for effectively the same location. Unlikely with coordinates sourced from DB records, but latent.
  - **Fix:** Round lat/lng to 4 decimal places before reading/writing the weather cache (matching Open-Meteo's own rounding).

- [ ] **#17 — `React.memo` not applied to `CampsiteCard`**
  - **File:** `app/components/Map.tsx:415–453`
  - **Problem:** Every weather update triggers a full `.map()` over the campsite array, creating new references for all cards even when their data hasn't changed. Fine at current scale (20 results); becomes a problem if page size grows.
  - **Fix:** Add `React.memo` to `CampsiteCard` as a preemptive guard.

- [ ] **#18 — Date-relative queries bypass cache across days**
  - **File:** `app/lib/parseIntent.ts:41`
  - **Problem:** `today`'s date is embedded in the Claude prompt to resolve "this weekend" / "next weekend". Two users searching "camping this weekend" on different days get different cache entries. This is inherent to relative-date queries but worth noting.
  - **Fix (optional, future):** Server-side normalise relative dates to explicit ISO dates before hashing the cache key, so queries on the same day share a cache entry.
