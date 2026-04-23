# Plan: Issue #92 — Refactor Map.tsx — extract pin components and data-fetching hook

## Context
Map.tsx has grown to 1387 lines — far beyond the ~380 lines when this issue was written. M5 (AI search), M6 (weather), and supercluster clustering all landed post-issue and significantly expanded the file. The issue asks for two well-defined extractions: typed pin components (CampsitePin, AmenityPin) and a data-fetching hook (useMapData). The "under 200 lines" acceptance criterion is unachievable at current file size, but the extractions themselves remove ~382 lines (1387 → 1005).

## Complexity
Medium — 4 files (Map.tsx modified, 3 new files created), pure refactoring, no behaviour changes.

## What to build / change

### 1. `app/components/CampsitePin.tsx` (extracted from Map.tsx lines 297–332)
- Type `CampsitePinProps` + `CampsitePin` component
- Needs: `FOREST_GREEN` from `@/lib/tokens`, `Campsite` from `@/types/map`

### 2. `app/components/AmenityPin.tsx` (extracted from Map.tsx lines 334–366)
- Type `AmenityPinProps` + `AmenityPin` component
- Needs: `FOREST_GREEN` from `@/lib/tokens`, `AmenityPOI` from `@/types/map`

### 3. `app/hooks/useMapData.ts` (extracted from scattered locations in Map.tsx)
Extract:
- Module-level async functions: `fetchCampsites`, `extractWeatherForecast`, `fetchWeatherBatch`, `fetchAmenities`
- Module-level constant: `MAX_FORECAST_DAYS`
- Helper: `computeVisibleBounds` (only used by hook callbacks)
- Local type: `Bounds`
- Refs: `fetchCounterRef`, `amenityFetchCounterRef`, `weatherFetchCounterRef`, `prevCampsitesLengthRef`, `weatherCacheRef`, `campsitesRef`
- State: `campsites`, `hasMore`, `amenityPois`
- Stable callbacks: `loadWeatherForViewport`, `loadCampsites`, `loadAmenities`

Hook signature — receives from MapView to keep dependencies clear:
```ts
type UseMapDataOptions = {
  drawerStateRef: React.MutableRefObject<DrawerState>;
  activeFiltersRef: React.MutableRefObject<FilterState>;
  activeChipRef: React.MutableRefObject<string | null>;
  selectedIdRef: React.MutableRefObject<string | null>;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  setDrawerState: (s: DrawerState) => void;
  setSelectedIdx: (i: number | null) => void;
  setSelectedPoiId: React.Dispatch<React.SetStateAction<string | null>>;
};
```

Returns: `{ campsites, hasMore, amenityPois, loadCampsites, loadAmenities, loadWeatherForViewport }`

### 4. `app/components/Map.tsx` — edited
- Remove all extracted code; add imports from new files
- Keep: all map state not in useMapData, cluster logic, effects, event handlers, JSX
- `campsitesRef` sync effect also moves into the hook (only read inside `loadWeatherForViewport`)

## Files
| # | Action | File | Notes |
|---|---|---|---|
| 1 | Create | `app/components/CampsitePin.tsx` | Extract from Map.tsx lines 297–332 |
| 2 | Create | `app/components/AmenityPin.tsx` | Extract from Map.tsx lines 334–366 |
| 3 | Create | `app/hooks/useMapData.ts` | Extract fetch fns, refs, state, stable callbacks |
| 4 | Edit | `app/components/Map.tsx` | Remove extracted code, add imports |

## Risks / unknowns
- `campsitesRef` is updated in a `useEffect` in MapView and read inside `handleMoveEnd`. Moving it into the hook is safe because `loadWeatherForViewport` (which reads it) also moves into the hook, and `handleMoveEnd` receives it from the hook return. The ref sync effect moves with it.
- `prevCampsitesLengthRef` interacts with `setDrawerState` (injected). Safe to move inside the hook — only read/written inside `loadCampsites`.
- `skipNextFetch` ref is owned by MapView and passed into `useMapData` because `loadCampsites` sets it on the drawer-open transition (0→results triggers setPadding which fires moveend).
- "Under 200 lines" AC is not achievable at 1387 lines; extraction removes ~382 lines (→ 1005). Flagged in PR notes.

## Verification
- `cd app && npm run lint` — no new errors
- `cd app && npm run build` — clean build
- Manual: start dev server, browse the map, tap a campsite pin, tap an amenity pin, apply filters — confirm no visual or behavioural regression

## Status
- [x] Branch created
- [x] Implementation complete
- [x] Acceptance criteria verified
- [x] Build & lint passing
- [ ] PR raised
