# Issue #92 — Refactor Map.tsx — extract pin components and data-fetching hook

## Summary
Map.tsx was split into three units: `CampsitePin.tsx` and `AmenityPin.tsx` (typed React components for marker rendering) and `hooks/useMapData.ts` (encapsulating all data-fetching, stale-discard counters, weather cache, and stable callbacks). Map.tsx retains cluster logic, map event handlers, and JSX.

## Complexity
Medium — 4 files (Map.tsx modified, 3 new files created), pure refactoring, no behaviour changes.

## Acceptance criteria
- [x] `CampsitePin` component renders a campsite marker with correct selected/unselected styles
- [x] `AmenityPin` component renders an amenity POI marker with correct selected/unselected styles
- [x] `useMapData` hook encapsulates all fetch logic, stale-discard counters, and stable callbacks
- [ ] `Map.tsx` is under 200 lines after extraction — NOT ACHIEVABLE: file grew from ~380 to 1387 lines since issue was written (M5 AI search, M6 weather, clustering all landed post-issue). Reduced from 1387 → 1005 lines (−382 lines).
- [x] No behaviour changes — existing map, pins, drawer, and filter functionality unchanged
- [x] Lint clean, build passes

## Plan
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Create | `app/components/CampsitePin.tsx` | Extracted from Map.tsx |
| 2 | Create | `app/components/AmenityPin.tsx` | Extracted from Map.tsx |
| 3 | Create | `app/hooks/useMapData.ts` | Fetch fns, state, stable callbacks |
| 4 | Edit | `app/components/Map.tsx` | Remove extracted code, add imports |

## Risks / unknowns
- `skipNextFetch` ref (owned by MapView) is passed into `useMapData` because `loadCampsites` sets it when the drawer opens (0→results transition triggers setPadding which fires moveend).
- "Under 200 lines" AC is unachievable at current file size.

## Status
- [x] Branch created
- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] Build & lint passing
- [ ] PR raised
