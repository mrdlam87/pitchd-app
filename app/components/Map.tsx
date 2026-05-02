"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import Supercluster from "supercluster";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilterPanel, { type FilterState } from "./FilterPanel";
import BottomDrawer, {
  type DrawerState,
  PEEK_HEIGHT_PX,
  DRAWER_TRANSITION_MS,
  getDrawerHeightPx,
} from "./BottomDrawer";
import type { AmenityPOI, Campsite } from "@/types/map";
import { BORDER, CORAL, FOREST_GREEN, SAGE } from "@/lib/tokens";
import { SEARCH_RESULTS_KEY, parseSearchResultsPayload, type SearchResultsPayload, type AISearchPayload } from "@/lib/searchResults";
import { QUICK_CHIPS, AMENITY_CHIPS } from "@/lib/chips";
import { CampsitePin } from "./CampsitePin";
import { AmenityPin, type AmenityPinMeta } from "./AmenityPin";
import { useMapData } from "@/hooks/useMapData";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.warn("[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
}

// Default centre: Sydney — used when location is denied or unavailable
const DEFAULT_VIEWPORT = {
  longitude: 151.2093,
  latitude: -33.8688,
  zoom: 10,
};

// Local metadata for each POI type — matches FilterPanel POI_OPTIONS and AmenityType seed data.
// Colors and icons must stay in sync with the AmenityType seed data in prisma/seed.ts.
const POI_META: Record<string, AmenityPinMeta> = {
  dump_point: { emoji: "🚐", label: "Dump point", color: "#c8870a" },
  water_fill: { emoji: "💧", label: "Water fill", color: "#2a8ab0" },
  laundromat: { emoji: "🧺", label: "Laundromat", color: "#7a6ab0" },
  toilets:    { emoji: "🚻", label: "Toilets",    color: "#4a9e6a" },
};

const EMPTY_FILTERS: FilterState = { activities: [], pois: [], startDate: null, endDate: null };

// Full-world bbox passed to getClusters so all loaded points are always considered.
// The API already scopes fetched data to the viewport, so filtering again here is
// redundant and causes a flash-of-empty race when bounds update before the fetch resolves.
const WORLD_BBOX: [number, number, number, number] = [-180, -90, 180, 90];

// radius is in screen pixels (zoom-adaptive). Pin body is 26px wide, so
// two pins overlap when centers are <26px apart. 40px adds a tap-target
// buffer — tighten toward 28 for stricter overlap-only clustering.
const CLUSTER_OPTIONS = { radius: 45, maxZoom: 14 } as const;

// Fit the map to the bounding box of a set of campsites.
// Uses reduce instead of spread to avoid V8 stack overflow on large arrays.
function fitToCampsites(map: mapboxgl.Map, campsites: Campsite[], bottomPad: number) {
  if (campsites.length === 0) return;
  const lats = campsites.map((c) => c.lat);
  const lngs = campsites.map((c) => c.lng);
  if (lats.length === 1) {
    map.flyTo({ center: [lngs[0], lats[0]], zoom: 11, duration: 800 });
  } else {
    const sw: [number, number] = [lngs.reduce((a, b) => Math.min(a, b)), lats.reduce((a, b) => Math.min(a, b))];
    const ne: [number, number] = [lngs.reduce((a, b) => Math.max(a, b)), lats.reduce((a, b) => Math.max(a, b))];
    map.fitBounds([sw, ne], {
      padding: { top: 120, right: 40, bottom: bottomPad + 20, left: 40 },
      duration: 800,
      maxZoom: 11,
    });
  }
}

// Reads and clears the search results payload written by HomeScreen before navigating here.
// Returns null if nothing is stored, the data is malformed, or sessionStorage is unavailable.
// Validates the shape at runtime so stale data from a previous app version can't cause a crash.
function consumeSearchResults(): SearchResultsPayload | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_RESULTS_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SEARCH_RESULTS_KEY);
    return parseSearchResultsPayload(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

type ClusterBubbleProps = { count: number; color: string; ariaLabel: string; onExpand: () => void };
function ClusterBubble({ count, color, ariaLabel, onExpand }: ClusterBubbleProps) {
  const size = count >= 50 ? 48 : count >= 10 ? 40 : 32;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onExpand}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      className="flex items-center justify-center rounded-full cursor-pointer font-black border-[2.5px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] text-white font-[family-name:var(--font-dm-sans)]"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size >= 48 ? 14 : 12,
      }}
    >
      {count}
    </div>
  );
}

export default function MapView() {
  // useState lazy initialiser runs synchronously on the first render — before any effects
  // or Mapbox's onLoad — eliminating the race between a useEffect sessionStorage read and
  // handleLoad firing on a warm tile cache. This is a "use client" component so it never
  // runs on the server; the try/catch in consumeSearchResults guards against malformed data.
  const [initialSearch] = useState<SearchResultsPayload | null>(() => consumeSearchResults());
  const initialSearchRef = useRef(initialSearch);
  // True while NL search results are displayed — suppresses handleMoveEnd from calling
  // loadCampsites (which would replace the results with browse results). Cleared when the
  // user taps the active Pitchd chip or applies filters.
  // Only AI search results put the map into locked search mode; direct-filter arrivals browse normally.
  // Legacy payloads (no kind field) have kind === undefined, so kind === "ai" is false — they
  // fall through to browse mode with no campsites. Intentional: sessionStorage is short-lived
  // so legacy entries clear naturally on the next navigation.
  const searchModeRef = useRef(initialSearch?.kind === "ai");
  // Key of the currently active quick chip (null = browse mode).
  // AI arrivals: chipKey flows through AISearchPayload (defaults to "pitchd" for textarea NL queries).
  // Direct-filter arrivals: no chip is highlighted — the activity shows in the filter count badge.
  const [activeChip, setActiveChip] = useState<string | null>(
    initialSearch?.kind === "ai" ? (initialSearch.chipKey ?? "pitchd") : null
  );
  // Ref mirrors activeChip so stable useCallback closures (e.g. loadWeatherForViewport)
  // can read the current chip key without needing it in their dependency array.
  const activeChipRef = useRef<string | null>(
    initialSearch?.kind === "ai" ? (initialSearch.chipKey ?? "pitchd") : null
  );
  // Query string shown as context below the map search input (AI searches only)
  const [searchContextQuery, setSearchContextQuery] = useState<string | null>(
    initialSearch?.kind === "ai" ? (initialSearch.query ?? null) : null
  );
  // Controlled value for the map search input
  const [mapQuery, setMapQuery] = useState("");
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapSearchError, setMapSearchError] = useState<string | null>(null);
  // Suppresses the geolocation flyTo when search results are loaded so the camera
  // doesn't pan away from the result bounds.
  // Safe today: MapView unmounts on navigation so this is never permanently stuck.
  // If MapView is ever reused without unmounting, revisit this.
  // Only suppress geolocation flyTo for AI arrivals — direct-filter arrivals start in browse mode.
  const suppressGeoFlyRef = useRef(initialSearch?.kind === "ai");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("peek");
  const [showFilters, setShowFilters] = useState(false);
  // Lazy initialiser runs once on mount — avoids recomputing the conditional on every render.
  const [activeFilters, setActiveFilters] = useState<FilterState>(() =>
    initialSearch?.kind === "direct" ? { ...initialSearch.filters, startDate: null, endDate: null } :
    initialSearch?.kind === "ai"     ? { activities: initialSearch.parsedIntent.amenities, pois: [], startDate: initialSearch.parsedIntent.startDate, endDate: initialSearch.parsedIntent.endDate } :
    EMPTY_FILTERS
  );
  // Ref mirrors state so loadCampsites always reads the latest filters without
  // needing activeFilters as a dependency (the callback is stable).
  // useRef has no lazy form — the ternary is cheap and the value is ignored after mount.
  const activeFiltersRef = useRef<FilterState>(
    initialSearch?.kind === "direct" ? { ...initialSearch.filters, startDate: null, endDate: null } :
    initialSearch?.kind === "ai"     ? { activities: initialSearch.parsedIntent.amenities, pois: [], startDate: initialSearch.parsedIntent.startDate, endDate: initialSearch.parsedIntent.endDate } :
    EMPTY_FILTERS
  );
  // Activities that Claude inferred from the last AI search — shown in FilterPanel as "Pitchd suggested".
  // Cleared when the user applies filters manually or clears search mode.
  const [aiSyncedActivities, setAiSyncedActivities] = useState<string[]>(
    initialSearch?.kind === "ai" ? initialSearch.parsedIntent.amenities : []
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Ref mirrors state so handleLoad always reads the latest value without
  // needing userLocation as a dependency (onLoad fires only once).
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // True after onLoad fires — guards the geo callback from calling flyTo before
  // the map is ready (mapRef.current is set at render time, before onLoad).
  const mapLoadedRef = useRef(false);
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // skipNextFetch suppresses the moveend handler for one event — used when code
  // calls easeTo/setPadding programmatically to avoid triggering a redundant fetch.
  const skipNextFetch = useRef(false);
  // Mirrors drawerState so loadCampsites (a stable useCallback) always reads the latest value
  const drawerStateRef = useRef<DrawerState>("peek");
  // Mirrors the selected campsite's ID so loadCampsites (stable callback) can
  // re-resolve the selection index after a fetch without needing selectedIdx as a dep.
  const selectedIdRef = useRef<string | null>(null);
  // Tracks the deferred scrollIntoView timeout so rapid pin clicks cancel the
  // previous pending scroll, and so it can be cleaned up on unmount.
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the currently selected campsite was last seen as an individual
  // (unclustered) pin. Used to detect zoom-out transitions that absorb the pin into
  // a cluster and should trigger deselection, while ignoring fresh selections of
  // campsites that are already clustered (where selectPin zooms in to uncluster).
  const selectedPinWasVisibleRef = useRef(false);
  // Mirrors selectedPinWasVisibleRef but for amenity POI selection — tracks the
  // visible→clustered transition that should trigger POI deselection.
  const selectedPoiWasVisibleRef = useRef(false);
  // Set to true while the zoom-to-uncluster animation is in flight.
  // Hides all markers during the animation so the many simultaneous CSS transform
  // updates don't drop frames; markers snap back in when moveend fires.
  const isUnclusteringRef = useRef(false);
  const [hideMarkers, setHideMarkers] = useState(false);

  // Tracks current zoom level for cluster computation.
  // Updated on every onMoveEnd and on initial onLoad.
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_VIEWPORT.zoom);

  const {
    campsites,
    hasMore,
    amenityPois,
    isInitialLoading,
    isFetching,
    weatherCacheRef,
    loadCampsites,
    loadAmenities,
    loadWeatherForViewport,
    setSearchResults,
    markInitialLoaded,
  } = useMapData({
    drawerStateRef,
    activeFiltersRef,
    activeChipRef,
    selectedIdRef,
    cardRefs,
    skipNextFetch,
    setDrawerState,
    setSelectedIdx,
    setSelectedPoiId,
  });

  // Campsite cluster index — rebuilt only when the campsite list changes.
  const campsiteClusterInstance = useMemo(() => {
    const sc = new Supercluster<{ id: string; idx: number }>(CLUSTER_OPTIONS);
    sc.load(
      campsites.map((c, i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
        properties: { id: c.id, idx: i },
      }))
    );
    return sc;
  }, [campsites]);

  // Amenity POI cluster index — rebuilt only when the amenity list changes.
  const amenityClusterInstance = useMemo(() => {
    const sc = new Supercluster<{ id: string; poiType: string }>(CLUSTER_OPTIONS);
    sc.load(
      amenityPois.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { id: p.id, poiType: p.amenityType.key },
      }))
    );
    return sc;
  }, [amenityPois]);

  // Visible campsite clusters — recomputed when zoom or data changes.
  const campsiteClusters = useMemo(
    () => campsiteClusterInstance.getClusters(WORLD_BBOX, Math.floor(currentZoom)),
    [campsiteClusterInstance, currentZoom]
  );

  // Visible amenity POI clusters.
  const amenityClusters = useMemo(
    () => amenityClusterInstance.getClusters(WORLD_BBOX, Math.floor(currentZoom)),
    [amenityClusterInstance, currentZoom]
  );

  // Mirrors campsiteClusters / amenityClusters so selectPin / selectPoi can read
  // the latest cluster state without taking them as dependencies (which would cause
  // the callbacks to be recreated on every zoom level change).
  const campsiteClustersRef = useRef([] as typeof campsiteClusters);
  const amenityClustersRef = useRef([] as typeof amenityClusters);

  // Pre-compute cluster bubble colors keyed by cluster ID so the render loop does
  // not call getLeaves on every render. Color is sampled from the first leaf only —
  // mixed-type clusters (e.g. toilets + dump points) show a single arbitrary color.
  // Intentional simplification; the "N amenities nearby" label avoids implying a single type.
  const amenityClusterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of amenityClusters) {
      if ("cluster" in f.properties && f.properties.cluster) {
        const clusterId = f.id as number;
        const leaves = amenityClusterInstance.getLeaves(clusterId, 1);
        const leafPoiType = (leaves[0]?.properties as { poiType?: string } | undefined)?.poiType;
        map.set(clusterId, leafPoiType ? (POI_META[leafPoiType]?.color ?? FOREST_GREEN) : FOREST_GREEN);
      }
    }
    return map;
  }, [amenityClusters, amenityClusterInstance]);

  // O(1) lookup for individual amenity POI features in the render loop.
  const amenityPoiById = useMemo(
    () => new Map(amenityPois.map((p) => [p.id, p])),
    [amenityPois]
  );

  // Deselect when the selected campsite transitions from a visible individual pin into
  // a cluster (i.e. the user zoomed out). Only triggers on that visible→clustered
  // transition — fresh selections of already-clustered campsites are not deselected
  // because selectPin zooms in to uncluster them first.
  useEffect(() => {
    if (selectedIdx === null) {
      selectedPinWasVisibleRef.current = false;
      return;
    }
    const isIndividualPin = campsiteClusters.some(
      (f) => !("cluster" in f.properties && f.properties.cluster) &&
             (f.properties as { idx: number }).idx === selectedIdx
    );
    if (isIndividualPin) {
      selectedPinWasVisibleRef.current = true;
      return;
    }
    // Pin is clustered. Only deselect if it was previously visible — that means the
    // user zoomed out and absorbed it. If it was never visible, selectPin is mid-zoom.
    if (selectedPinWasVisibleRef.current) {
      selectedPinWasVisibleRef.current = false;
      setSelectedIdx(null);
      selectedIdRef.current = null;
      setDrawerState("peek");
    }
  }, [campsiteClusters, selectedIdx]);

  // Deselect when the selected amenity POI transitions from a visible individual pin
  // into a cluster (i.e. the user zoomed out). Mirrors the campsite deselection effect.
  useEffect(() => {
    if (selectedPoiId === null) {
      selectedPoiWasVisibleRef.current = false;
      return;
    }
    const isIndividualPin = amenityClusters.some(
      (f) => !("cluster" in f.properties && f.properties.cluster) &&
             (f.properties as { id: string }).id === selectedPoiId
    );
    if (isIndividualPin) {
      selectedPoiWasVisibleRef.current = true;
      return;
    }
    if (selectedPoiWasVisibleRef.current) {
      selectedPoiWasVisibleRef.current = false;
      setSelectedPoiId(null);
      setDrawerState("peek");
    }
  }, [amenityClusters, selectedPoiId]);

  // Request user geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        setUserLocation(loc);
        if (mapLoadedRef.current && !suppressGeoFlyRef.current) {
          mapRef.current?.flyTo({
            center: [loc.lng, loc.lat],
            zoom: 11,
            duration: 1200,
            padding: { top: 0, right: 0, bottom: getDrawerHeightPx(drawerStateRef.current), left: 0 },
          });
        }
      },
      () => { /* denied or unavailable — map stays at DEFAULT_VIEWPORT (Sydney) */ },
      { timeout: 10_000 }
    );
  }, []);

  useEffect(() => {
    drawerStateRef.current = drawerState;
  }, [drawerState]);

  // Passed to BottomDrawer as onDrawerStateChange. Syncs Mapbox camera padding
  // alongside the React state so that subsequent easeTo/flyTo calls correctly
  // account for the new drawer height when centering pins. This handles state
  // changes triggered by the More/Less button and touch drag snaps.
  // Note: selectPin/selectPoi set drawerState directly and pass padding
  // explicitly in their easeTo calls — they do not go through this callback.
  const handleDrawerStateChange = useCallback((state: DrawerState) => {
    setDrawerState(state);
    // Do NOT call map.setPadding here — it animates the camera to compensate
    // for the padding change, causing the map to pan/shift visibly whenever
    // the drawer opens or closes. All explicit camera movements (easeTo,
    // fitBounds, selectPin) already pass padding directly, so Mapbox's
    // internal padding state doesn't need to track the drawer in real-time.
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    activeFiltersRef.current = activeFilters;
  }, [activeFilters]);


  useEffect(() => {
    campsiteClustersRef.current = campsiteClusters;
  }, [campsiteClusters]);

  useEffect(() => {
    amenityClustersRef.current = amenityClusters;
  }, [amenityClusters]);

  const handleLoad = useCallback(
    (e: { target: mapboxgl.Map }) => {
      mapLoadedRef.current = true;
      setCurrentZoom(e.target.getZoom());

      // If we arrived from an AI NL search, display those results immediately and
      // fit the map to show all pins. Skip the browse API fetch.
      // Direct-filter arrivals fall through to browse mode with pre-applied filters.
      const searchPayload = initialSearchRef.current;
      if (searchPayload?.kind === "ai" && searchPayload.campsites.length > 0) {
        initialSearchRef.current = null;
        setSearchResults(searchPayload.campsites);
        setDrawerState("half");
        drawerStateRef.current = "half";

        // Suppress the moveend that fitBounds/flyTo fires after its animation, and
        // prevent the geolocation callback from flying away from the results.
        skipNextFetch.current = true;
        suppressGeoFlyRef.current = true;
        fitToCampsites(e.target, searchPayload.campsites, getDrawerHeightPx("half"));

        // Fetch weather only for pins visible in the initial viewport.
        // loadWeatherForViewport increments weatherFetchCounterRef, so a subsequent
        // pan invalidates this fetch and loadWeatherForViewport runs again for the
        // new visible set.
        loadWeatherForViewport(e.target, searchPayload.campsites);
        markInitialLoaded();
        return;
      }

      // Search payload was present but returned no campsites — fall back to browse mode.
      // Reset both refs so handleMoveEnd fires normally and geolocation flyTo works.
      searchModeRef.current = false;
      suppressGeoFlyRef.current = false;

      const loc = userLocationRef.current;
      if (loc) {
        mapRef.current?.flyTo({
          center: [loc.lng, loc.lat],
          zoom: 11,
          duration: 1200,
          padding: { top: 0, right: 0, bottom: getDrawerHeightPx(drawerStateRef.current), left: 0 },
        });
      } else {
        // No user location — set the initial camera padding to match the peek
        // drawer height so computeVisibleBounds starts from a consistent baseline.
        // setPadding fires moveend internally (easeTo duration:0) — skipNextFetch
        // suppresses that so loadCampsites below isn't called a second time.
        skipNextFetch.current = true;
        e.target.setPadding({ top: 0, right: 0, bottom: PEEK_HEIGHT_PX, left: 0 });
        loadCampsites(e.target);
        loadAmenities(e.target);
      }
    },
    [loadCampsites, loadAmenities, loadWeatherForViewport, setSearchResults, markInitialLoaded]
  );

  const handleMoveEnd = useCallback(
    (e: { target: mapboxgl.Map }) => {
      // Always update zoom so cluster computation stays current,
      // even when the fetch is skipped (e.g. after programmatic setPadding).
      setCurrentZoom(e.target.getZoom());

      // Always clear unclustering state unconditionally — a fast drag can fire moveend
      // before isUnclusteringRef is set, leaving a second moveend with the ref already
      // reset and hideMarkers stuck true. Clearing here regardless is safe: a no-op
      // when we weren't unclustering, and always correct when we were.
      isUnclusteringRef.current = false;
      setHideMarkers(false);

      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      // While NL search results are active, suppress browse fetches but still
      // fetch weather for any newly visible pins that haven't been cached yet.
      if (searchModeRef.current) {
        loadWeatherForViewport(e.target);
        return;
      }
      loadCampsites(e.target);
      loadAmenities(e.target);
    },
    [loadCampsites, loadAmenities, loadWeatherForViewport]
  );

  const selectPoi = useCallback(
    (poi: AmenityPOI, animate = true) => {
      setDrawerState("half");
      setSelectedPoiId(poi.id);
      setSelectedIdx(null);
      selectedIdRef.current = null;
      if (animate && mapRef.current) {
        skipNextFetch.current = true;
        const isIndividualPin = amenityClustersRef.current.some(
          (f) => !("cluster" in f.properties && f.properties.cluster) &&
                 (f.properties as { id: string }).id === poi.id
        );
        if (!isIndividualPin) {
          isUnclusteringRef.current = true;
          setHideMarkers(true);
        }
        mapRef.current.easeTo({
          center: [poi.lng, poi.lat],
          ...(isIndividualPin ? {} : { zoom: CLUSTER_OPTIONS.maxZoom + 1 }),
          duration: isIndividualPin ? 300 : 450,
          padding: { top: 0, right: 0, bottom: getDrawerHeightPx("half"), left: 0 },
        });
      }
    },
    []
  );

  const selectPin = useCallback(
    (i: number, animate = true) => {
      setDrawerState("half");
      setSelectedIdx(i);
      setSelectedPoiId(null);
      const campsite = campsites[i];
      selectedIdRef.current = campsite?.id ?? null;
      if (animate && campsite && mapRef.current) {
        skipNextFetch.current = true;
        const isIndividualPin = campsiteClustersRef.current.some(
          (f) => !("cluster" in f.properties && f.properties.cluster) &&
                 (f.properties as { idx: number }).idx === i
        );
        if (!isIndividualPin) {
          // Hide markers for the duration of the zoom animation — with many clusters
          // in view, simultaneous CSS transform updates on each frame cause jank.
          // Markers snap back in cleanly once moveend fires at the new zoom level.
          isUnclusteringRef.current = true;
          setHideMarkers(true);
        }
        mapRef.current.easeTo({
          center: [campsite.lng, campsite.lat],
          // Zoom past maxZoom so supercluster renders it as an individual pin.
          // CLUSTER_OPTIONS.maxZoom is 14; at 15 every point is unclustered.
          ...(isIndividualPin ? {} : { zoom: CLUSTER_OPTIONS.maxZoom + 1 }),
          duration: isIndividualPin ? 300 : 450,
          padding: { top: 0, right: 0, bottom: getDrawerHeightPx("half"), left: 0 },
        });
      }
      if (animate) {
        requestAnimationFrame(() => {
          cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } else {
        if (scrollTimeoutRef.current !== null) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          scrollTimeoutRef.current = null;
          cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, DRAWER_TRANSITION_MS);
      }
    },
    [campsites]
  );

  const handleApplyFilters = useCallback(
    (filters: FilterState) => {
      setActiveFilters(filters);
      // Write ref directly here in addition to the useEffect sync — the useEffect
      // fires after render, which is too late for the synchronous loadCampsites
      // call below. Without this, the first search after applying filters would
      // still use the previous filter values.
      activeFiltersRef.current = filters;
      // Applying filters signals intent to browse — exit NL search mode so
      // subsequent moveend events trigger normal browse fetches again.
      searchModeRef.current = false;
      suppressGeoFlyRef.current = false;
      setActiveChip(null);
      activeChipRef.current = null;
      setSearchContextQuery(null);
      setAiSyncedActivities([]);
      setShowFilters(false);
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        loadCampsites(map);
        loadAmenities(map);
      }
    },
    [loadCampsites, loadAmenities],
  );

  // Inline NL search — stays on the map, replaces results without navigating home.
  async function handleMapSearch(q: string, chipKey: string | null = null) {
    if (!q.trim() || mapSearchLoading) return;
    setMapSearchLoading(true);
    setMapSearchError(null);
    // Highlight the chip immediately so it reflects the pending search state.
    // Reverted to null in the catch block (error) or the no-results branch.
    if (chipKey !== null) {
      setActiveChip(chipKey);
      activeChipRef.current = chipKey;
    }
    // Use the current map centre as the search origin so chip searches stay in the
    // area you're viewing — not the user's GPS location which may be far away.
    const mapCenter = mapRef.current?.getMap().getCenter();
    const lat = mapCenter?.lat ?? userLocationRef.current?.lat ?? -33.8688;
    const lng = mapCenter?.lng ?? userLocationRef.current?.lng ?? 151.2093;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q.trim(),
          lat,
          lng,
          // Pass filter panel dates so manual date selection feeds into weather ranking
          startDate: activeFiltersRef.current.startDate ?? undefined,
          endDate: activeFiltersRef.current.endDate ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Search failed");
      }
      const data = (await res.json()) as Pick<AISearchPayload, "campsites" | "parsedIntent">;
      // Pre-populate client weather cache from search response weather so
      // loadWeatherForViewport finds all campsites already cached and skips
      // the extra round-trip to /api/weather/batch.
      for (const c of data.campsites) {
        if (c.weather != null) {
          weatherCacheRef.current.set(c.id, c.weather);
        }
      }
      setSearchResults(data.campsites);
      setMapQuery("");
      if (data.campsites.length > 0 && mapRef.current) {
        // Results — enter search mode and fit the map to the pins
        setDrawerState("half");
        drawerStateRef.current = "half";
        searchModeRef.current = true;
        setActiveChip(chipKey ?? "pitchd");
        activeChipRef.current = chipKey ?? "pitchd";
        setAiSyncedActivities(data.parsedIntent.amenities);
        // Intentionally replace activities (not merge) — the new query redefines
        // intent and any prior activity selection is stale. pois are preserved
        // because the AI doesn't infer POI types.
        // Replace activities and dates from AI intent — new query redefines intent.
        // pois are preserved (explicit user choices, not AI-inferred).
        // Dates: always take AI-inferred dates from parsedIntent for a new search so
        // that e.g. "camping next weekend" isn't silently overridden by dates the user
        // set in the filter panel during a previous search session.
        const aiFilters: FilterState = {
          ...activeFiltersRef.current,
          activities: data.parsedIntent.amenities,
          startDate: data.parsedIntent.startDate,
          endDate: data.parsedIntent.endDate,
        };
        setActiveFilters(aiFilters);
        activeFiltersRef.current = aiFilters;
        setSearchContextQuery(q.trim());
        skipNextFetch.current = true;
        suppressGeoFlyRef.current = true;
        fitToCampsites(mapRef.current.getMap(), data.campsites, getDrawerHeightPx("half"));
        // Fetch weather only for pins visible after fitToCampsites settles.
        // loadWeatherForViewport uses the bounds at call time — fitToCampsites
        // fires a camera animation so the visible set may shift slightly, but the
        // next pan (handleMoveEnd) will fill in any newly revealed pins.
        loadWeatherForViewport(mapRef.current.getMap(), data.campsites);
      } else {
        // No results — stay in browse mode so handleMoveEnd keeps firing
        searchModeRef.current = false;
        suppressGeoFlyRef.current = false;
        setActiveChip(null);
        activeChipRef.current = null;
        setSearchContextQuery(null);
      }
    } catch (e) {
      console.error("[MapSearch]", e);
      suppressGeoFlyRef.current = false;
      setActiveChip(null);
      activeChipRef.current = null;
      setMapSearchError(e instanceof Error ? e.message : "Search failed. Please try again.");
    } finally {
      setMapSearchLoading(false);
    }
  }

  const handleClearSearch = useCallback(() => {
    searchModeRef.current = false;
    suppressGeoFlyRef.current = false;
    setActiveChip(null);
    activeChipRef.current = null;
    setSearchContextQuery(null);
    setMapSearchError(null);
    setAiSyncedActivities([]);
    // Reset AI-inferred activities and dates so browse results aren't silently
    // filtered after the user exits search mode. pois are preserved — they reflect
    // explicit user choices (amenity chips / filter panel) not AI inference.
    const resetFilters: FilterState = { ...activeFiltersRef.current, activities: [], startDate: null, endDate: null };
    setActiveFilters(resetFilters);
    activeFiltersRef.current = resetFilters;
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      loadCampsites(map);
      loadAmenities(map);
    }
  }, [loadCampsites, loadAmenities]);

  const handleAmenityChip = useCallback(
    (poiType: string) => {
      const current = activeFiltersRef.current.pois;
      const next = current.includes(poiType)
        ? current.filter((p: string) => p !== poiType)
        : [...current, poiType];
      const newFilters = { ...activeFiltersRef.current, pois: next };
      setActiveFilters(newFilters);
      activeFiltersRef.current = newFilters;
      if (mapRef.current) loadAmenities(mapRef.current.getMap());
    },
    [loadAmenities],
  );

  // Handles QUICK_CHIPS with a filterKey (dog, fishing, hiking, swimming).
  // Toggles the activity filter directly — no AI call, stays in browse mode.
  // Also exits any active AI search mode so the map doesn't stay locked.
  const handleDirectFilterChip = useCallback(
    (filterKey: string) => {
      // When exiting AI search mode, reset activities to [] before toggling so AI-inferred
      // filters don't silently carry forward into browse mode. Consistent with handleClearSearch.
      const baseActivities = searchModeRef.current ? [] : activeFiltersRef.current.activities;
      searchModeRef.current = false;
      suppressGeoFlyRef.current = false;
      setSearchContextQuery(null);
      setMapSearchError(null);
      setActiveChip(null);
      activeChipRef.current = null;
      setAiSyncedActivities([]);
      const next = baseActivities.includes(filterKey)
        ? baseActivities.filter((a: string) => a !== filterKey)
        : [...baseActivities, filterKey];
      const newFilters: FilterState = { ...activeFiltersRef.current, activities: next };
      setActiveFilters(newFilters);
      activeFiltersRef.current = newFilters;
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        loadCampsites(map);
        loadAmenities(map);
      }
    },
    [loadCampsites, loadAmenities],
  );

  // TODO M4: pois toggles increment this badge — will read as campsite filters active.
  // Fix when campsite/amenity linkage lands and the two filter surfaces are separated.
  const filterCount = activeFilters.activities.length + activeFilters.pois.length;

  const showDrawer = campsites.length > 0 || selectedPoiId !== null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Filter panel overlay */}
      {showFilters && (
        <FilterPanel
          initialFilters={activeFilters}
          aiSyncedActivities={aiSyncedActivities}
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Floating search bar + quick chips — z-[60] must exceed drawer (z-50) */}
      <div className="absolute top-3 left-3 right-3 z-[60] flex flex-col gap-2">
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-full border border-[#e0dbd0] bg-white px-4 py-2.5 font-[family-name:var(--font-dm-sans)] shadow-md">
          <div className="min-w-0 flex-1">
            <input
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleMapSearch(mapQuery, null); }}
              placeholder="New search…"
              disabled={mapSearchLoading}
              className="w-full bg-transparent text-sm text-[#1a2e1a] outline-none placeholder:text-[#8a9e8a] disabled:opacity-60"
            />
            {searchContextQuery && !mapQuery && (
              <div className="mt-0.5 truncate text-[10px] text-[#8a9e8a]">{searchContextQuery}</div>
            )}
          </div>
          {/* Search icon */}
          <button
            type="button"
            onClick={() => void handleMapSearch(mapQuery, null)}
            disabled={!mapQuery.trim() || mapSearchLoading}
            aria-label="Search"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${mapQuery.trim() ? "bg-[#e8674a]" : "bg-[#e8f0e8]"}`}
          >
            {mapSearchLoading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke={mapQuery.trim() ? "#fff" : "#5a7a5a"} strokeWidth="1.8" />
                <path d="M11 11l3 3" stroke={mapQuery.trim() ? "#fff" : "#5a7a5a"} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <div className="h-4 w-px shrink-0 bg-[#e0dbd0]" />
          {/* Filters button */}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label={`Filters${filterCount > 0 ? ` (${filterCount} active)` : ""}`}
            className="shrink-0 text-xs font-bold text-[#e8674a] font-[family-name:var(--font-dm-sans)]"
          >
            Filters{filterCount > 0 ? ` (${filterCount})` : ""}
          </button>
        </div>

        {/* Search error */}
        {mapSearchError && (
          <div className="rounded-xl border border-[#fdd] bg-white px-3 py-2 text-xs text-[#e8674a] shadow-sm">
            {mapSearchError}
          </div>
        )}

        {/* Quick chips */}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {[...QUICK_CHIPS, ...AMENITY_CHIPS].map((chip) => {
            // filterKey is the discriminator: non-null = direct DB filter, null = AI search.
            const filterKey = chip.kind === "amenity" ? null : chip.filterKey;
            const isActive = chip.kind === "amenity"
              ? activeFilters.pois.includes(chip.poiType)
              : filterKey !== null
                ? activeFilters.activities.includes(filterKey)  // driven by filter state → syncs with FilterPanel and HomeScreen
                : activeChip === chip.key;                       // AI chips (Pitchd, weather) use activeChip
            const handleClick = chip.kind === "amenity"
              ? () => handleAmenityChip(chip.poiType)
              : filterKey !== null
                ? () => handleDirectFilterChip(filterKey)        // direct toggle, no AI call
                : isActive
                  ? handleClearSearch
                  : () => void handleMapSearch(chip.query, chip.key);
            // AI chips have no filterKey and are kind="quick" — only they trigger mapSearchLoading.
            const isAiChip = chip.kind === "quick" && filterKey === null;
            const isDisabled = isAiChip && mapSearchLoading;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={handleClick}
                disabled={isDisabled}
                aria-label={chip.icon === "logo" ? chip.label : undefined}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold font-[family-name:var(--font-dm-sans)] shadow-sm transition-all duration-150 disabled:opacity-50 ${
                  isActive
                    ? chip.kind === "quick" && chip.primary
                      ? "bg-[#e8674a] border-[#e8674a] text-white"
                      : "bg-[#2d4a2d] border-[#2d4a2d] text-white"
                    : chip.kind === "quick" && chip.primary
                      ? "bg-white border-[#e0dbd0] text-[#e8674a]"
                      : "bg-white border-[#e0dbd0] text-[#1a2e1a]"
                }`}
              >
                {chip.icon === "logo" ? (
                  <span className="flex items-baseline">
                    <span className={`font-[family-name:var(--font-lora)] text-[11px] font-bold ${isActive ? "text-white" : "text-[#2d4a2d]"}`}>Pitch</span>
                    <span className={`font-[family-name:var(--font-lora)] text-[11px] font-bold ${isActive ? "text-white/75" : "text-[#e8674a]"}`}>d</span>
                  </span>
                ) : (
                  <>
                    <span className="text-xs" aria-hidden="true">{chip.icon}</span>
                    <span>{chip.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <MapGL
        ref={mapRef}
        mapLib={mapboxgl}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEWPORT}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        minZoom={7}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        // Use setDrawerState directly (not handleDrawerStateChange) — calling
        // map.setPadding inside an active drag gesture cancels the gesture via
        // its internal easeTo(duration:0) and makes the map stutter.
        onDragStart={() => setDrawerState("peek")}
        onClick={() => {
          setSelectedIdx(null);
          selectedIdRef.current = null;
          setSelectedPoiId(null);
        }}
      >
        {/* User location dot — zIndex must exceed selected pin (10) */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} style={{ zIndex: 20 }}>
            <div
              className="w-[11px] h-[11px] rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              style={{ background: CORAL, border: "2.5px solid #fff" }}
            />
          </Marker>
        )}

        {/* Campsite pins / clusters — hidden while zoom-to-uncluster animation plays */}
        {!hideMarkers && campsiteClusters.map((feature) => {
          const [fLng, fLat] = feature.geometry.coordinates;
          if ("cluster" in feature.properties && feature.properties.cluster) {
            const count = (feature.properties as { point_count: number }).point_count;
            const clusterId = feature.id as number;
            return (
              <Marker key={`cs-cluster-${clusterId}`} longitude={fLng} latitude={fLat} anchor="center" style={{ zIndex: 2 }}>
                <ClusterBubble
                  count={count}
                  color={FOREST_GREEN}
                  ariaLabel={`${count} campsites — tap to expand`}
                  onExpand={() => {
                    try {
                      const zoom = campsiteClusterInstance.getClusterExpansionZoom(clusterId);
                      // +1 (integer) guarantees the cluster splits — +0.5 is floored to the same
                      // integer by getClusters and leaves the cluster unchanged at maxZoom.
                      mapRef.current?.easeTo({ center: [fLng, fLat], zoom: zoom + 1, duration: 400 });
                    } catch (err) {
                      /* stale cluster ID — safe to ignore */
                      if (process.env.NODE_ENV !== "production") console.warn("[cluster] getClusterExpansionZoom failed", err);
                    }
                  }}
                />
              </Marker>
            );
          }
          const { idx } = feature.properties as { id: string; idx: number };
          const campsite = campsites[idx];
          if (!campsite) return null;
          return (
            <Marker key={campsite.id} longitude={campsite.lng} latitude={campsite.lat} anchor="bottom" style={{ zIndex: selectedIdx === idx ? 10 : 1 }}>
              <CampsitePin campsite={campsite} idx={idx} isSelected={selectedIdx === idx} onSelect={() => selectPin(idx, false)} />
            </Marker>
          );
        })}

        {/* AmenityPOI pins / clusters — hidden while zoom-to-uncluster animation plays */}
        {!hideMarkers && amenityClusters.map((feature) => {
          const [fLng, fLat] = feature.geometry.coordinates;
          if ("cluster" in feature.properties && feature.properties.cluster) {
            const count = (feature.properties as { point_count: number }).point_count;
            const clusterId = feature.id as number;
            const clusterColor = amenityClusterColorMap.get(clusterId) ?? FOREST_GREEN;
            return (
              <Marker key={`poi-cluster-${clusterId}`} longitude={fLng} latitude={fLat} anchor="center" style={{ zIndex: 2 }}>
                <ClusterBubble
                  count={count}
                  color={clusterColor}
                  ariaLabel={`${count} amenities nearby — tap to expand`}
                  onExpand={() => {
                    try {
                      const zoom = amenityClusterInstance.getClusterExpansionZoom(clusterId);
                      mapRef.current?.easeTo({ center: [fLng, fLat], zoom: zoom + 1, duration: 400 });
                    } catch (err) {
                      /* stale cluster ID — safe to ignore */
                      if (process.env.NODE_ENV !== "production") console.warn("[cluster] getClusterExpansionZoom failed", err);
                    }
                  }}
                />
              </Marker>
            );
          }
          const { id: poiId } = feature.properties as { id: string; poiType: string };
          const poi = amenityPoiById.get(poiId);
          if (!poi) return null;
          const meta = POI_META[poi.amenityType.key] ?? { emoji: "📍", label: poi.amenityType.key, color: FOREST_GREEN };
          return (
            <Marker key={poi.id} longitude={poi.lng} latitude={poi.lat} anchor="bottom" style={{ zIndex: selectedPoiId === poi.id ? 10 : 1 }}>
              <AmenityPin poi={poi} meta={meta} isSelected={selectedPoiId === poi.id} onSelect={() => selectPoi(poi)} />
            </Marker>
          );
        })}
      </MapGL>

      {/* Initial load spinner — shown until first campsite fetch resolves.
          z-20 sits above map markers (max z-index 10) but below the drawer (z-50). */}
      {isInitialLoading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(247,245,240,0.82)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-12 h-12 rounded-full animate-spin"
            style={{ border: `3px solid ${BORDER}`, borderTopColor: CORAL }}
          />
          <div className="text-center">
            <p className="font-serif text-base font-bold mb-1" style={{ color: FOREST_GREEN }}>
              Pitching the best spots…
            </p>
            <p className="text-xs" style={{ color: SAGE }}>
              Loading campsites nearby
            </p>
          </div>
        </div>
      )}

      {/* Bottom drawer — z-50 must exceed marker z-index (max 10) */}
      {showDrawer && (
        <BottomDrawer
          campsites={campsites}
          hasMore={hasMore}
          amenityPois={amenityPois}
          poiMeta={POI_META}
          selectedIdx={selectedIdx}
          selectedPoiId={selectedPoiId}
          userLocation={userLocation}
          cardRefs={cardRefs}
          drawerState={drawerState}
          onDrawerStateChange={handleDrawerStateChange}
          onSelectPin={selectPin}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}
