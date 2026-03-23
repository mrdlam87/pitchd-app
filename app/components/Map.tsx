"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import FilterPanel, { type FilterState } from "./FilterPanel";
import BottomDrawer, {
  type DrawerState,
  PEEK_HEIGHT_PX,
  DRAWER_TRANSITION_MS,
  getDrawerHeightPx,
} from "./BottomDrawer";
import type { AmenityPOI, Campsite, WeatherDay } from "@/types/map";
import { CORAL, FOREST_GREEN } from "@/lib/tokens";
import { SEARCH_RESULTS_KEY, parseSearchResultsPayload, type SearchResultsPayload, type AISearchPayload } from "@/lib/searchResults";
import { QUICK_CHIPS, AMENITY_CHIPS } from "@/lib/chips";

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
const POI_META: Record<string, { emoji: string; label: string; color: string }> = {
  dump_point: { emoji: "🚐", label: "Dump point", color: "#c8870a" },
  water_fill: { emoji: "💧", label: "Water fill", color: "#2a8ab0" },
  laundromat: { emoji: "🧺", label: "Laundromat", color: "#7a6ab0" },
  toilets:    { emoji: "🚻", label: "Toilets",    color: "#4a9e6a" },
};

type FetchResult = { results: Campsite[]; hasMore: boolean };

type Bounds = { north: number; south: number; east: number; west: number };

async function fetchCampsites(bounds: Bounds, amenities: string[] = []): Promise<FetchResult> {
  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east:  String(bounds.east),
    west:  String(bounds.west),
  });
  amenities.forEach((key) => params.append("amenities", key));
  try {
    const res = await fetch(`/api/campsites?${params}`);
    if (!res.ok) {
      console.warn(`[fetchCampsites] ${res.status} ${res.statusText}`);
      return { results: [], hasMore: false };
    }
    const data = await res.json();
    return { results: data.results ?? [], hasMore: data.hasMore ?? false };
  } catch (e) {
    console.warn("[fetchCampsites] fetch failed", e);
    return { results: [], hasMore: false };
  }
}

// Extracts day-0 weather data from an Open-Meteo forecast response.
// Returns null if the response shape is unexpected.
function extractWeatherDay(forecast: unknown): WeatherDay | null {
  if (typeof forecast !== "object" || forecast === null) return null;
  const f = forecast as Record<string, unknown>;
  if (typeof f.daily !== "object" || f.daily === null) return null;
  const d = f.daily as Record<string, unknown>;
  if (!Array.isArray(d.temperature_2m_max) || !Array.isArray(d.temperature_2m_min)) return null;
  if (!Array.isArray(d.precipitation_sum) || !Array.isArray(d.weathercode)) return null;
  const tempMax = d.temperature_2m_max[0];
  const tempMin = d.temperature_2m_min[0];
  const precipitationSum = d.precipitation_sum[0];
  const weatherCode = d.weathercode[0];
  if (typeof tempMax !== "number" || typeof tempMin !== "number") return null;
  if (typeof precipitationSum !== "number" || typeof weatherCode !== "number") return null;
  return { tempMax, tempMin, precipitationSum, weatherCode };
}

// Fetches weather for a batch of campsites from /api/weather/batch.
// Returns the same array with weather attached — failures result in weather: null.
// Never throws; errors are logged and each campsite gets weather: null.
async function fetchWeatherBatch(campsites: Campsite[]): Promise<Campsite[]> {
  if (campsites.length === 0) return campsites;
  const locations = campsites.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }));
  try {
    const res = await fetch("/api/weather/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    if (!res.ok) {
      console.warn(`[fetchWeatherBatch] ${res.status} ${res.statusText}`);
      return campsites.map((c) => ({ ...c, weather: null }));
    }
    const data = (await res.json()) as { results: Record<string, unknown> };
    return campsites.map((c) => ({
      ...c,
      weather: extractWeatherDay(data.results[c.id]) ?? null,
    }));
  } catch (e) {
    console.warn("[fetchWeatherBatch] fetch failed", e);
    return campsites.map((c) => ({ ...c, weather: null }));
  }
}

// Fetches AmenityPOIs for all active POI types in parallel.
// Converts viewport bounds to a centre + radius so the amenities API can use its
// existing bounding-box filter.
async function fetchAmenities(bounds: Bounds, poiTypes: string[]): Promise<AmenityPOI[]> {
  if (poiTypes.length === 0) return [];

  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east  + bounds.west)  / 2;
  const latKm = ((bounds.north - bounds.south) / 2) * 111.32;
  const lngKm = ((bounds.east  - bounds.west)  / 2) * 111.32 * Math.cos((centerLat * Math.PI) / 180);
  const radius = Math.min(Math.ceil(Math.sqrt(latKm * latKm + lngKm * lngKm)), 500);

  const fetches = poiTypes.map(async (type) => {
    const params = new URLSearchParams({
      lat:    String(centerLat),
      lng:    String(centerLng),
      radius: String(radius),
      type,
    });
    try {
      const res = await fetch(`/api/amenities?${params}`);
      if (!res.ok) {
        console.warn(`[fetchAmenities] ${res.status} for type=${type}`);
        return [] as AmenityPOI[];
      }
      const data = await res.json();
      if (data.truncated) console.warn(`[fetchAmenities] result capped at 200 for type=${type} — consider zooming in`);
      return (data.results ?? []) as AmenityPOI[];
    } catch (e) {
      console.warn(`[fetchAmenities] fetch failed for type=${type}`, e);
      return [] as AmenityPOI[];
    }
  });

  const groups = await Promise.all(fetches);
  return groups.flat();
}

// Returns the exact lat/lng bounding box of the visible area above the drawer.
function computeVisibleBounds(map: mapboxgl.Map, drawerHeightPx: number): Bounds {
  const w = map.getCanvas().clientWidth;
  const h = map.getCanvas().clientHeight;
  const visH = Math.max(h - drawerHeightPx, 1);

  const nw = map.unproject([0, 0]);
  const se = map.unproject([w, visH]);

  return {
    north: nw.lat,
    south: se.lat,
    east:  se.lng,
    west:  nw.lng,
  };
}


const EMPTY_FILTERS: FilterState = { activities: [], pois: [] };


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

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
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
  const [hasMore, setHasMore] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [amenityPois, setAmenityPois] = useState<AmenityPOI[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("peek");
  const [showFilters, setShowFilters] = useState(false);
  // Lazy initialiser runs once on mount — avoids recomputing the conditional on every render.
  const [activeFilters, setActiveFilters] = useState<FilterState>(() =>
    initialSearch?.kind === "direct" ? initialSearch.filters :
    initialSearch?.kind === "ai"     ? { activities: initialSearch.parsedIntent.amenities, pois: [] } :
    EMPTY_FILTERS
  );
  // Ref mirrors state so loadCampsites always reads the latest filters without
  // needing activeFilters as a dependency (the callback is stable).
  // useRef has no lazy form — the ternary is cheap and the value is ignored after mount.
  const activeFiltersRef = useRef<FilterState>(
    initialSearch?.kind === "direct" ? initialSearch.filters :
    initialSearch?.kind === "ai"     ? { activities: initialSearch.parsedIntent.amenities, pois: [] } :
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
  // Monotonic counter — discard results from stale in-flight requests
  const fetchCounterRef = useRef(0);
  // Separate counter for amenity fetches — same stale-discard pattern
  const amenityFetchCounterRef = useRef(0);
  // Separate counter for weather fetches — incremented before every weather batch
  // call (browse and AI search) so stale weather updates don't overwrite newer results.
  const weatherFetchCounterRef = useRef(0);
  // Mirrors drawerState so loadCampsites (a stable useCallback) always reads the latest value
  const drawerStateRef = useRef<DrawerState>("peek");
  // Tracks the previous fetch's result count so loadCampsites can detect 0 → results
  // transitions without calling a state setter inside another setter's updater function.
  const prevCampsitesLengthRef = useRef(0);
  // Mirrors the selected campsite's ID so loadCampsites (stable callback) can
  // re-resolve the selection index after a fetch without needing selectedIdx as a dep.
  const selectedIdRef = useRef<string | null>(null);
  // Tracks the deferred scrollIntoView timeout so rapid pin clicks cancel the
  // previous pending scroll, and so it can be cleaned up on unmount.
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadCampsites = useCallback((map: mapboxgl.Map) => {
    const id = ++fetchCounterRef.current;
    const bounds = computeVisibleBounds(map, getDrawerHeightPx(drawerStateRef.current));
    const filters = activeFiltersRef.current;
    const amenities = [...filters.activities, ...filters.pois];
    fetchCampsites(bounds, amenities).then(({ results, hasMore }) => {
      if (id !== fetchCounterRef.current) return; // stale fetch — discard
      cardRefs.current = [];
      // Re-open to half only on 0 → results transition.
      // Also sync map padding so Mapbox knows the drawer now covers ~52vh —
      // without this, pin centering and bounds computation stay at PEEK_HEIGHT_PX
      // until the next user-triggered easeTo. skipNextFetch suppresses the
      // moveend that setPadding's internal easeTo(duration:0) fires.
      if (results.length > 0 && prevCampsitesLengthRef.current === 0) {
        setDrawerState("half");
        skipNextFetch.current = true;
        map.setPadding({ top: 0, right: 0, bottom: getDrawerHeightPx("half"), left: 0 });
      }
      prevCampsitesLengthRef.current = results.length;
      setCampsites(results);
      setHasMore(hasMore);
      const newIdx = selectedIdRef.current
        ? results.findIndex((c) => c.id === selectedIdRef.current)
        : -1;
      setSelectedIdx(newIdx >= 0 ? newIdx : null);
      if (newIdx < 0) selectedIdRef.current = null;
      // Fetch weather in the background — pins render immediately above; cards
      // gain weather badges once the batch response arrives.
      if (results.length > 0) {
        const wid = ++weatherFetchCounterRef.current;
        fetchWeatherBatch(results).then((withWeather) => {
          if (wid !== weatherFetchCounterRef.current) return; // stale — a newer weather fetch superseded this one
          setCampsites(withWeather);
        });
      }
    });
  }, []);

  const loadAmenities = useCallback((map: mapboxgl.Map) => {
    const poiTypes = activeFiltersRef.current.pois;
    if (poiTypes.length === 0) {
      setAmenityPois([]);
      setSelectedPoiId(null);
      return;
    }
    const id = ++amenityFetchCounterRef.current;
    const bounds = computeVisibleBounds(map, getDrawerHeightPx(drawerStateRef.current));
    fetchAmenities(bounds, poiTypes).then((results) => {
      if (id !== amenityFetchCounterRef.current) return;
      setAmenityPois(results);
      setSelectedPoiId((prev) =>
        prev && results.some((p) => p.id === prev) ? prev : null
      );
    });
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

  const handleLoad = useCallback(
    (_e: { target: mapboxgl.Map }) => {
      mapLoadedRef.current = true;

      // If we arrived from an AI NL search, display those results immediately and
      // fit the map to show all pins. Skip the browse API fetch.
      // Direct-filter arrivals fall through to browse mode with pre-applied filters.
      const searchPayload = initialSearchRef.current;
      if (searchPayload?.kind === "ai" && searchPayload.campsites.length > 0) {
        initialSearchRef.current = null;
        setCampsites(searchPayload.campsites);
        prevCampsitesLengthRef.current = searchPayload.campsites.length;
        setDrawerState("half");
        drawerStateRef.current = "half";

        // Suppress the moveend that fitBounds/flyTo fires after its animation, and
        // prevent the geolocation callback from flying away from the results.
        skipNextFetch.current = true;
        suppressGeoFlyRef.current = true;
        fitToCampsites(_e.target, searchPayload.campsites, getDrawerHeightPx("half"));

        // Fetch weather in the background — no stale-guard needed here since
        // handleLoad only fires once per MapView mount.
        fetchWeatherBatch(searchPayload.campsites).then((withWeather) => {
          setCampsites(withWeather);
        });
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
        _e.target.setPadding({ top: 0, right: 0, bottom: PEEK_HEIGHT_PX, left: 0 });
        loadCampsites(_e.target);
        loadAmenities(_e.target);
      }
    },
    [loadCampsites, loadAmenities]
  );

  const handleMoveEnd = useCallback(
    (e: { target: mapboxgl.Map }) => {
      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      // While NL search results are active, suppress browse fetches so the map
      // doesn't silently replace search results when the user pans.
      if (searchModeRef.current) return;
      loadCampsites(e.target);
      loadAmenities(e.target);
    },
    [loadCampsites, loadAmenities]
  );

  const selectPoi = useCallback(
    (poi: AmenityPOI, animate = true) => {
      setDrawerState("half");
      setSelectedPoiId(poi.id);
      setSelectedIdx(null);
      selectedIdRef.current = null;
      if (animate && mapRef.current) {
        skipNextFetch.current = true;
        mapRef.current.easeTo({
          center: [poi.lng, poi.lat],
          duration: 300,
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
        mapRef.current.easeTo({
          center: [campsite.lng, campsite.lat],
          duration: 300,
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
    // Use the current map centre as the search origin so chip searches stay in the
    // area you're viewing — not the user's GPS location which may be far away.
    const mapCenter = mapRef.current?.getMap().getCenter();
    const lat = mapCenter?.lat ?? userLocationRef.current?.lat ?? -33.8688;
    const lng = mapCenter?.lng ?? userLocationRef.current?.lng ?? 151.2093;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), lat, lng }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Search failed");
      }
      const data = (await res.json()) as Pick<AISearchPayload, "campsites" | "parsedIntent">;
      setCampsites(data.campsites);
      prevCampsitesLengthRef.current = data.campsites.length;
      setMapQuery("");
      if (data.campsites.length > 0 && mapRef.current) {
        // Results — enter search mode and fit the map to the pins
        setDrawerState("half");
        drawerStateRef.current = "half";
        searchModeRef.current = true;
        setActiveChip(chipKey ?? "pitchd");
        setAiSyncedActivities(data.parsedIntent.amenities);
        // Intentionally replace activities (not merge) — the new query redefines
        // intent and any prior activity selection is stale. pois are preserved
        // because the AI doesn't infer POI types.
        const aiFilters: FilterState = { ...activeFiltersRef.current, activities: data.parsedIntent.amenities };
        setActiveFilters(aiFilters);
        activeFiltersRef.current = aiFilters;
        setSearchContextQuery(q.trim());
        skipNextFetch.current = true;
        suppressGeoFlyRef.current = true;
        fitToCampsites(mapRef.current.getMap(), data.campsites, getDrawerHeightPx("half"));
        // Fetch weather in the background after displaying results
        const wid = ++weatherFetchCounterRef.current;
        fetchWeatherBatch(data.campsites).then((withWeather) => {
          if (wid !== weatherFetchCounterRef.current) return; // stale — a newer search fired
          setCampsites(withWeather);
        });
      } else {
        // No results — stay in browse mode so handleMoveEnd keeps firing
        searchModeRef.current = false;
        suppressGeoFlyRef.current = false;
        setActiveChip(null);
        setSearchContextQuery(null);
      }
    } catch (e) {
      console.error("[MapSearch]", e);
      suppressGeoFlyRef.current = false;
      setMapSearchError(e instanceof Error ? e.message : "Search failed. Please try again.");
    } finally {
      setMapSearchLoading(false);
    }
  }

  const handleClearSearch = useCallback(() => {
    searchModeRef.current = false;
    suppressGeoFlyRef.current = false;
    setActiveChip(null);
    setSearchContextQuery(null);
    setMapSearchError(null);
    setAiSyncedActivities([]);
    // Reset AI-inferred activities so browse results aren't silently filtered
    // after the user exits search mode. pois are preserved — they reflect
    // explicit user choices (amenity chips / filter panel) not AI inference.
    const resetFilters: FilterState = { ...activeFiltersRef.current, activities: [] };
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

        {/* Campsite pins */}
        {campsites.map((campsite, i) => {
          const isSel = selectedIdx === i;
          const shortName = campsite.name
            .replace(" National Park", " NP")
            .replace(" Conservation Park", " CP")
            .split(" – ")[0];
          const pinW = isSel ? 34 : 26;
          const pinH = isSel ? 37 : 28;
          return (
            <Marker
              key={campsite.id}
              longitude={campsite.lng}
              latitude={campsite.lat}
              anchor="bottom"
              style={{ zIndex: isSel ? 10 : 1 }}
            >
              <div
                role="button"
                tabIndex={0}
                className="relative flex flex-col items-center cursor-pointer select-none"
                onClick={(e) => { e.stopPropagation(); selectPin(i, false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPin(i, false); }
                }}
                aria-label={`Select campsite ${i + 1}: ${campsite.name}`}
              >
                <svg
                  style={{
                    width: pinW,
                    height: pinH,
                    filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSel ? 0.45 : 0.28}))`,
                    transition: "width 150ms, height 150ms",
                  }}
                  viewBox="0 0 26 28"
                  fill="none"
                >
                  <path
                    d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
                    fill={isSel ? FOREST_GREEN : "#fff"}
                    stroke={FOREST_GREEN}
                    strokeWidth="1.5"
                  />
                  <text
                    x="13" y="12.5"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSel ? "#fff" : FOREST_GREEN}
                    fontSize={isSel ? 11 : 9}
                    fontWeight="800"
                    fontFamily="DM Sans, sans-serif"
                  >
                    {i + 1}
                  </text>
                </svg>
                <div
                  className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSel ? "font-bold" : "font-semibold"}`}
                  style={{
                    color: FOREST_GREEN,
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: isSel ? 11 : 10,
                    textShadow: "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)",
                  }}
                >
                  {shortName}
                </div>
              </div>
            </Marker>
          );
        })}

        {/* AmenityPOI pins */}
        {amenityPois.map((poi) => {
          const isSel = selectedPoiId === poi.id;
          const meta = POI_META[poi.amenityType.key] ?? { emoji: "📍", label: poi.amenityType.key, color: FOREST_GREEN };
          const pinW = isSel ? 34 : 26;
          const pinH = isSel ? 37 : 28;
          return (
            <Marker
              key={poi.id}
              longitude={poi.lng}
              latitude={poi.lat}
              anchor="bottom"
              style={{ zIndex: isSel ? 10 : 1 }}
            >
              <div
                role="button"
                tabIndex={0}
                className="relative flex flex-col items-center cursor-pointer select-none"
                onClick={(e) => { e.stopPropagation(); selectPoi(poi); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPoi(poi); }
                }}
                aria-label={`Select ${meta.label}${poi.name ? `: ${poi.name}` : ""}`}
              >
                <svg
                  style={{
                    width: pinW,
                    height: pinH,
                    filter: `drop-shadow(0 2px 6px rgba(0,0,0,${isSel ? 0.45 : 0.28}))`,
                    transition: "width 150ms, height 150ms",
                  }}
                  viewBox="0 0 26 28"
                  fill="none"
                >
                  <path
                    d="M13 1.5C7.2 1.5 2.5 6.2 2.5 12C2.5 18.5 9 24 13 26C17 24 23.5 18.5 23.5 12C23.5 6.2 18.8 1.5 13 1.5Z"
                    fill="#fff"
                    stroke={meta.color}
                    strokeWidth={isSel ? "2.5" : "1.5"}
                  />
                </svg>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    fontSize: isSel ? 12 : 10,
                    lineHeight: 1,
                    top: 0,
                    width: pinW,
                    height: Math.round(pinH * 0.72),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {meta.emoji}
                </div>
                <div
                  className={`absolute left-full top-1/2 -translate-y-1/2 ml-1 w-max max-w-[140px] leading-tight ${isSel ? "font-bold" : "font-semibold"}`}
                  style={{
                    color: FOREST_GREEN,
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: isSel ? 11 : 10,
                    textShadow: "0 0 3px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.12)",
                  }}
                >
                  {poi.name ?? meta.label}
                </div>
              </div>
            </Marker>
          );
        })}
      </MapGL>

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
        />
      )}
    </div>
  );
}
