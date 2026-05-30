# Plan: Issue #120 — Overhaul map search (site names, amenity routing, UX)

## Context

The search pipeline treats every query as rigid NL extraction against a 4-amenity allowlist. Three failure modes:

1. **Name queries miss their target** — `prisma.campsite.findMany` filters only by bounding box + amenity keys; no `name` or `region` filter exists. "Lane Cove campground" returns all sites in the inferred box, not the named one.
2. **Amenity-service queries route wrong** — "dump points near me" runs the campsite pipeline and returns campsites; it should return `AmenityPOI` results.
3. **Free-form amenity intent is silently dropped** — `ALLOWED_AMENITIES = ["dog_friendly","fishing","hiking","swimming"]`; Claude drops anything outside this list. A query about firepits or flush toilets has zero effect on results.

Additional UX gaps: no recent searches, input clears after search (can't edit previous query), context label at `text-[10px]` is illegible, no exit from locked search mode, Filters button has no visual affordance, zero-results shows a blank drawer.

Related: #121 covers how amenity-only results are *presented* in the drawer once they arrive. This issue covers everything upstream of that — parsing, routing, and search bar UX.

## Complexity

Large — 6 tasks across 5 files. Tasks 1–3 are schema/data-layer (sequential). Tasks 4–5 are search bar UX (can start after Task 1). Task 6 is the empty state (depends on Task 5).

## Key files

| File | Role |
|---|---|
| `app/lib/parseIntent.ts` | `ParsedIntent` interface + Claude prompt + validation |
| `app/lib/searchCache.ts` | Cache read/write — sanitiser must handle new fields |
| `app/lib/searchResults.ts` | `SearchResultsPayload` types + runtime parser |
| `app/app/api/search/route.ts` | DB query (bounding box + amenity filter only today) |
| `app/components/Map.tsx` | Map search bar UI, `handleMapSearch`, search mode state |
| `app/lib/chips.ts` | Imports `ALLOWED_AMENITIES` — update if allowlist changes |

## What to build / change

### Task 1 — Extend `ParsedIntent` + Claude prompt (`parseIntent.ts`, `searchCache.ts`, `searchResults.ts`)

Add to `ParsedIntent` interface:
```ts
siteName: string | null;          // specific campsite/park name, separate from location area
resultType: "campsites" | "amenities" | null;  // route the result type
poiTypes: string[] | null;        // ["dump_point","water_fill"] when resultType === "amenities"
amenityHints: string[];           // free-form intent Claude couldn't map to ALLOWED_AMENITIES
```

Update Claude prompt:
- Add `siteName` rule: "specific campsite, campground, or reserve name — NOT a city or region. Use `location` for areas."
- Add `resultType` rule: set to "amenities" when query is about finding a service POI (dump point, water fill, toilets, laundromat), not a campsite. Default "campsites".
- Add `poiTypes` rule: array of POI type keys when `resultType === "amenities"` — use keys from `["dump_point","water_fill","toilets","laundromat"]`.
- Add `amenityHints` rule: free-form array of amenity descriptions Claude extracted but can't map to ALLOWED_AMENITIES (e.g. `["firepit","flush toilets","river views"]`). Empty array if none.
- Keep `amenities` for exact DB key matches (existing behaviour preserved).
- Update the JSON shape example in the prompt to include all new fields.

Update `parseIntentWithClaude` validation:
- `siteName`: string check + trim, null if absent/empty
- `resultType`: allow only `"campsites"` | `"amenities"` | `null`
- `poiTypes`: array of strings, filter to known POI keys only
- `amenityHints`: array of strings, cap each at 100 chars, max 10 items

Update `getCachedIntent` sanitiser — new fields must default safely for pre-migration entries:
```ts
siteName: typeof raw.siteName === "string" ? raw.siteName.trim() || null : null,
resultType: raw.resultType === "amenities" ? "amenities" : raw.resultType === "campsites" ? "campsites" : null,
poiTypes: Array.isArray(raw.poiTypes) ? raw.poiTypes.filter((p): p is string => typeof p === "string") : null,
amenityHints: Array.isArray(raw.amenityHints) ? raw.amenityHints.filter((h): h is string => typeof h === "string") : [],
```

Update `parseSearchResultsPayload` in `searchResults.ts` to accept the new `ParsedIntent` shape without breaking validation. The existing `parsedIntent.amenities` array check stays — just add safe defaults for new fields.

---

### Task 2 — Add site name filter to DB query (`route.ts`)

When `parsedIntent.siteName` is non-null, add an `OR` clause to the campsite `where` filter:
```ts
...(parsedIntent.siteName && {
  OR: [
    { name: { contains: parsedIntent.siteName, mode: "insensitive" } },
    { region: { contains: parsedIntent.siteName, mode: "insensitive" } },
  ],
}),
```

This applies **within** the existing bounding box — both filters are active simultaneously. If the named site is outside the inferred bounding box (e.g. user GPS is Melbourne but searching for "Ku-ring-gai"), the geocode path already handles centring. The name filter narrows results within the box once the box is correctly centred.

---

### Task 3 — Amenity-only result routing (`route.ts`, `searchResults.ts`, `Map.tsx`)

**Route changes (`route.ts`):**

When `parsedIntent.resultType === "amenities"`, skip the campsite pipeline entirely and query `AmenityPOI` by type + bounding box:
```ts
if (parsedIntent.resultType === "amenities") {
  const amenityPois = await prisma.amenityPOI.findMany({
    where: {
      lat: { gte: searchLat - latDelta, lte: searchLat + latDelta },
      lng: { gte: searchLng - lngDelta, lte: searchLng + lngDelta },
      ...(parsedIntent.poiTypes?.length && {
        amenityType: { key: { in: parsedIntent.poiTypes } },
      }),
      syncStatus: SyncStatus.active,
    },
    select: {
      id: true, name: true, lat: true, lng: true,
      amenityType: { select: { key: true, label: true, icon: true, color: true } },
    },
    take: RESULT_LIMIT,
  });
  return Response.json({ amenityPois, parsedIntent });
}
```

**`searchResults.ts` changes:**

Add `AmenitySearchPayload` kind and update the union:
```ts
export type AmenitySearchPayload = {
  kind: "amenity-search";
  amenityPois: AmenityPOI[];
  parsedIntent: ParsedIntent;
  query: string;
};
export type SearchResultsPayload = AISearchPayload | DirectFilterPayload | AmenitySearchPayload;
```

Update `parseSearchResultsPayload` to validate the new `"amenity-search"` kind (check `amenityPois` is an array with `lat`/`lng` numbers).

**`Map.tsx` changes (minimal):**

In `consumeSearchResults` and wherever `initialSearch.kind` is narrowed, add a guard for `"amenity-search"` — `searchModeRef.current = false` (amenity search does not lock the map), set `amenityPois` from the payload instead of `campsites`. The drawer rendering for amenity-only mode is deferred to #121; show an empty or stub drawer for now.

---

### Task 4 — Recent searches in localStorage (`Map.tsx` or `app/lib/recentSearches.ts`)

Utility functions (extract to `app/lib/recentSearches.ts`):
```ts
const KEY = "pitchd:recentSearches";
const MAX = 5;

export function getRecentSearches(): string[] { /* localStorage read with try/catch */ }
export function addRecentSearch(query: string): void { /* prepend, dedup, cap at MAX, write */ }
```

In `Map.tsx`:
- Call `addRecentSearch(query)` on every successful NL search submission
- On search input focus: if input is empty, show a dropdown of `getRecentSearches()`
- Tapping a recent query fills the input and calls `handleMapSearch`
- Dismiss dropdown on blur or when user starts typing
- localStorage errors must be caught silently — wrap all reads/writes in try/catch

---

### Task 5 — Search bar UX: pre-populate, context label, clear affordance, Filters button (`Map.tsx`)

**Pre-populate input:** Initialise `mapQuery` state from `initialSearch.query`:
```ts
const [mapQuery, setMapQuery] = useState(
  initialSearch?.kind === "ai" || initialSearch?.kind === "amenity-search"
    ? (initialSearch.query ?? "")
    : ""
);
```

**Context label — legible size and parsed summary:**
Replace `text-[10px]` with `text-xs` minimum. Replace raw `searchContextQuery` text with a formatted summary built from `parsedIntent`:
```
"Near Blue Mountains · 3hr · Dog friendly · This weekend"
```
Build this summary inline from `parsedIntent.location`, `parsedIntent.driveTimeHrs`, `parsedIntent.amenities`, and `parsedIntent.startDate`. Show summary label only when in search mode.

**Clear / Browse area affordance:**
Add a "✕ Browse area" button inline with the context label. On tap:
- `searchModeRef.current = false`
- `setActiveChip(null)` + `activeChipRef.current = null`
- `setSearchContextQuery(null)`
- `setMapQuery("")`
- `setAiSyncedActivities([])`
- `activeFiltersRef.current = EMPTY_FILTERS` + `setActiveFilters(EMPTY_FILTERS)`
- Call `loadCampsites()`

**Placeholder:** Change from `"New search…"` to `"Site name, area, or describe your trip…"`

**Filters button:** Add a visible border and background; ensure `min-h-[44px]` touch target:
```tsx
<button
  className="border border-[#e0dbd0] bg-white rounded-lg px-3 min-h-[44px] text-sm font-medium"
  ...
>
  Filters {filterCount > 0 && <span>({filterCount})</span>}
</button>
```

---

### Task 6 — Zero-results empty state in drawer (`BottomDrawer.tsx` or `Map.tsx`)

When the search pipeline returns 0 campsites (or 0 amenity POIs for amenity-only), the drawer shows a blank peek. Instead, render an empty state card:

```
No campsites found near [location]
Try broadening your search or clearing filters.

[Broaden search]  [Browse this area]
```

"Broaden search" increases `driveTimeHrs` by 1 and re-submits (or simply shows a hint). "Browse this area" calls the clear-search flow from Task 5.

Pass an `isEmpty` boolean to `BottomDrawer` alongside `campsites` — or handle it in `Map.tsx` by rendering the empty state inside the drawer's content slot.

---

## Files summary

| # | Action | File | Notes |
|---|---|---|---|
| 1 | Edit | `app/lib/parseIntent.ts` | New fields, expanded prompt, updated validation |
| 2 | Edit | `app/lib/searchCache.ts` | Sanitiser defaults for new fields |
| 3 | Edit | `app/lib/searchResults.ts` | `AmenitySearchPayload`, updated parser |
| 4 | Edit | `app/app/api/search/route.ts` | `siteName` filter, amenity-only branch |
| 5 | Create | `app/lib/recentSearches.ts` | localStorage read/write utility |
| 6 | Edit | `app/components/Map.tsx` | Pre-populate, context label, clear button, recent searches dropdown, Filters button, amenity-search kind guard |
| 7 | Edit | `app/components/BottomDrawer.tsx` | Empty state rendering |

## Decisions

### `siteName` bounding box — do not relax (MVP)
When `siteName` is set but the geocoded box doesn't contain the named site (e.g. user is in Melbourne, searches "Ku-ring-gai Chase campground" with no location context), the name filter returns zero results. **Decision: accept this limitation for now.** The workaround is natural — adding a location ("…near Sydney") triggers `location` geocoding and centres the box correctly. The failure case requires naming a specific site 900km away with no location context, an edge case at beta scale. Note the limitation in the PR. Revisit post-launch if it surfaces in user feedback.

The right long-term fix (geocode `siteName` as a fallback when the name filter returns zero results) is deferred — it adds a second Nominatim call on misses and meaningful complexity.

### `amenityHints` — pass-through only, do not wire to ranking
`amenityHints` is captured in `ParsedIntent` and stored in the cache but **not used by the ranking pipeline in this issue.** The `CampsiteAmenity` join table is currently empty (per CLAUDE.md data notes) — fuzzy-matching hints against empty join data would ship with zero user-visible benefit. Note in the PR that this is intentional, not an oversight. Wire to ranking in a follow-up issue once amenity join data is populated.

## Risks / unknowns

- **Cache sanitiser must handle missing fields** — any new field missing from a pre-migration entry must default safely. Add explicit defaults for all 4 new fields in `getCachedIntent`.
- **`AmenityPOI` table schema** — verify the Prisma model name and field names before writing the amenity-only query. Check `prisma/schema.prisma` for the exact model.
- **#121 dependency** — Task 3 defines the `"amenity-search"` payload shape; #121 consumes it. Coordinate on the `AmenitySearchPayload` type before both are merged.

## Verification

- `cd app && npm run build` — clean TypeScript build
- `cd app && npm test` — integration tests pass (add tests for siteName filter, amenity-only route, cache sanitiser new fields)
- Manual: "Lane Cove campground" → named site appears in results
- Manual: "dump points near me" → returns amenityPois, not campsites
- Manual: search 3 times, tap search bar, see recent searches dropdown
- Manual: arrive from NL search, confirm input pre-populated with previous query
- Manual: tap "✕ Browse area", confirm map returns to browse mode
- Manual (375px viewport): Filters button ≥44px touch target, context label readable

## PRs and sub-issues

| PR / Issue | Tasks | Status |
|---|---|---|
| PR #128 (`feature/120-search-overhaul`) | Task 1 — ParsedIntent schema | Open, 5 review rounds addressed — ready to merge |
| Issue #129 | Tasks 2 + 3 — site name filter + amenity routing | Not started |
| Issue #130 | Tasks 4 + 5 + 6 — recent searches, search bar UX, empty state | Not started |
| Issue #131 | Refactor: extract `sanitiseParsedIntent` from `parseIntentWithClaude` | Not started |

Branch for all work: `feature/120-search-overhaul`

## Status
- [x] Branch created (`feature/120-search-overhaul`)
- [x] Task 1 complete (ParsedIntent schema + prompt) — PR #128, all review comments addressed (5 rounds)
  - amenityHints bounds (slice 10 / 100-char cap) applied in both sanitisers
  - poiTypes gated on resultType === "amenities" first; forced null otherwise
  - poiTypes deduplicated via Array.from(new Set(...)) in both sanitisers
  - siteName capped at 200 chars in both sanitisers
  - amenityHints whitespace-string filter added
  - max_tokens raised 400 → 500; prompt caps amenityHints at 5 phrases
  - resultType prompt rule corrected: null = ambiguous, not dead code
  - Issue #131 created and linked for sanitiseParsedIntent extraction
  - 35 integration tests passing
- [x] Task 2 complete (site name DB filter) — PR #132 merged 2026-05-29
- [x] Task 3 complete (amenity-only routing) — PR #132 merged 2026-05-29
- [ ] Task 4 complete (recent searches) — issue #130
- [ ] Task 5 complete (search bar UX) — issue #130
- [ ] Task 6 complete (empty state) — issue #130
- [ ] All tests passing
- [ ] All PRs merged
