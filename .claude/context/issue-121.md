# Plan: Issue #121 — Context-aware drawer results model, amenity-only search, and campsite detail view

## Context

Three UX gaps in the bottom drawer that need fixing together because they all stem from the drawer's single fixed content model:

1. `BottomDrawer.tsx` computes `resultLabel` (line 610) with one formula for all modes: "X campsites found · nearby". Since #120 landed (and #136–138 added region/location search), amenity-only NL searches show "0 campsites found", region searches say "· nearby" when they should say "in Blue Mountains", etc.

2. No campsite detail sheet. Tapping a card calls `onSelectPin(i)` which scrolls/highlights in the list. There is no isolated detail view.

3. `selectPoi` in `Map.tsx` (line 700) always calls `mapRef.current.easeTo(...)` — even for individual visible pins. The fix: only animate for cluster expansion; individual pins should highlight in place.

## Complexity
Medium — 2 files changed, significant UI in BottomDrawer, no DB/schema/API changes.

## What to build / change

### 1. `app/components/BottomDrawer.tsx`
- Export `DrawerMode = "browse" | "ai-search" | "region" | "location" | "amenity-only"`
- Import `ParsedIntent` from `@/lib/parseIntent`
- Add `drawerMode: DrawerMode` and `parsedIntent: ParsedIntent | null` to `Props`
- Rewrite `resultLabel` to switch on `drawerMode` (browse/ai-search/region/location/amenity-only)
- Update `DrawerContentList`: add `drawerMode` + `onOpenDetail` props; in amenity-only mode render all `amenityPois` as `POICard` list; in other modes existing behaviour + call `onOpenDetail(campsite)` on card select
- Add `EmptySearchState` optional `title` prop for amenity-only empty state
- Fix `hasContent`/`allowExpand` to include `drawerMode === "amenity-only" && amenityPois.length > 0`
- Remove hardcoded `"· nearby"` suffix from summary row (line 707)
- Add `CampsiteDetailSheet` component: absolute overlay, scenic header, name/region/drive, DayWeatherCells, AmenityTags, NavigateButton, back arrow, slide-up animation, swipe-down dismiss
- Add `detailCampsite: Campsite | null` state + `listScrollRef` + `savedScrollRef` for scroll restoration
- Render `CampsiteDetailSheet` inside `Drawer.Content`

### 2. `app/components/Map.tsx`
- Import `DrawerMode` from `./BottomDrawer`
- Add `drawerMode: DrawerMode` state with lazy initialiser from `initialSearch`
- Call `setDrawerMode(...)` in all search transitions (handleLoad, fetchRegionCampsites, fetchLocationCampsites, handleMapSearch, handleClearSearch, handleApplyFilters, handleDirectFilterChip, handleRecentSelect)
- Fix `handleLoad` amenity-search branch: add missing `setSearchParsedIntent(searchPayload.parsedIntent)` call
- Pass `drawerMode` and `parsedIntent={searchParsedIntent}` to `BottomDrawer`
- Fix `selectPoi`: skip `easeTo` entirely for individual visible pins; only animate for cluster expansion

## Files
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Edit | `app/components/BottomDrawer.tsx` | DrawerMode, label rewrite, amenity-only list, detail sheet |
| 2 | Edit | `app/components/Map.tsx` | drawerMode state, selectPoi fix, pass props |

## Verification
```bash
cd app && npm run lint && npm run build && npm test
```

## Status
- [x] Branch created
- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] Build & lint passing
- [ ] PR raised
