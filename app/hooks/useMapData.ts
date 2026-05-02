import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DrawerState } from "@/components/BottomDrawer";
import { getDrawerHeightPx } from "@/components/BottomDrawer";
import type { FilterState } from "@/components/FilterPanel";
import { DAY_NAMES } from "@/types/map";
import type { AmenityPOI, Campsite, WeatherDay } from "@/types/map";
import type mapboxgl from "mapbox-gl";

export type Bounds = { north: number; south: number; east: number; west: number };

type FetchResult = { results: Campsite[]; hasMore: boolean };

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

// Extracts weather data from an Open-Meteo forecast response.
// When startDate/endDate are provided, only days within that range are included
// (matching the date window used for ranking). Without dates, falls back to the
// first MAX_FORECAST_DAYS (4) days — intentionally wider than the server-side
// extractForecastDays default (today+tomorrow) because browse-mode cards show
// more days than the 2-day ranking window needs.
// See also: extractForecastDays in app/lib/weatherRanking.ts (server-side counterpart).
// Returns null if the response shape is unexpected; gracefully handles absent
// precipitation_probability_max (old cache entries) by setting null.
const MAX_FORECAST_DAYS = 4;
function extractWeatherForecast(
  forecast: unknown,
  startDate?: string | null,
  endDate?: string | null,
): WeatherDay[] | null {
  if (typeof forecast !== "object" || forecast === null) return null;
  const f = forecast as Record<string, unknown>;
  if (typeof f.daily !== "object" || f.daily === null) return null;
  const d = f.daily as Record<string, unknown>;
  if (!Array.isArray(d.temperature_2m_max) || !Array.isArray(d.temperature_2m_min)) return null;
  if (!Array.isArray(d.precipitation_sum) || !Array.isArray(d.weathercode)) return null;
  if (!Array.isArray(d.time)) return null;

  const probArr = Array.isArray(d.precipitation_probability_max)
    ? (d.precipitation_probability_max as unknown[])
    : null;

  const days: WeatherDay[] = [];
  for (let i = 0; i < (d.time as unknown[]).length; i++) {
    const dateStr = d.time[i];
    if (typeof dateStr !== "string") continue;

    // Date range filter:
    // - Full range supplied: show only days within [startDate, endDate].
    // - startDate only (partial range): show MAX_FORECAST_DAYS days from startDate.
    // - No dates (browse mode): show first MAX_FORECAST_DAYS days of the forecast.
    if (startDate && endDate) {
      if (dateStr < startDate || dateStr > endDate) continue;
    } else if (startDate) {
      if (dateStr < startDate) continue;
      if (days.length >= MAX_FORECAST_DAYS) break;
    } else if (days.length >= MAX_FORECAST_DAYS) {
      break;
    }

    const tempMax = d.temperature_2m_max[i];
    const tempMin = d.temperature_2m_min[i];
    const precipitationSum = d.precipitation_sum[i];
    const weatherCode = d.weathercode[i];
    // Skip malformed days rather than aborting the whole array. Day 0 is the
    // most critical (shown in compact mode); if it is missing, the caller
    // receives a shorter array and the WeatherStrip shows fewer segments.
    if (typeof tempMax !== "number" || typeof tempMin !== "number") continue;
    if (typeof precipitationSum !== "number" || typeof weatherCode !== "number") continue;
    // T00:00:00 forces local-time midnight parsing — without it, `new Date("2024-03-23")`
    // is parsed as UTC midnight and .getDay() returns the wrong day in UTC+ timezones.
    const dow = new Date(dateStr + "T00:00:00").getDay();
    const precipProbRaw = probArr?.[i];
    days.push({
      date: dateStr,
      dayName: DAY_NAMES[dow],
      tempMax,
      tempMin,
      precipitationSum,
      precipProbability: typeof precipProbRaw === "number" ? precipProbRaw : null,
      weatherCode,
    });
  }
  return days.length > 0 ? days : null;
}

// Fetches weather for a batch of campsites from /api/weather/batch.
// startDate/endDate filter the displayed days to the search date window (when supplied).
// Returns the same array with weather attached — failures result in weather: null.
// Never throws; errors are logged and each campsite gets weather: null.
async function fetchWeatherBatch(
  campsites: Campsite[],
  startDate?: string | null,
  endDate?: string | null,
): Promise<Campsite[]> {
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
      weather: extractWeatherForecast(data.results[c.id], startDate, endDate) ?? null,
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

export type UseMapDataOptions = {
  drawerStateRef: MutableRefObject<DrawerState>;
  activeFiltersRef: MutableRefObject<FilterState>;
  activeChipRef: MutableRefObject<string | null>;
  selectedIdRef: MutableRefObject<string | null>;
  cardRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  skipNextFetch: MutableRefObject<boolean>;
  setDrawerState: (s: DrawerState) => void;
  setSelectedIdx: (i: number | null) => void;
  setSelectedPoiId: Dispatch<SetStateAction<string | null>>;
};

export type UseMapDataReturn = {
  campsites: Campsite[];
  hasMore: boolean;
  amenityPois: AmenityPOI[];
  // True until the first loadCampsites fetch resolves (browse mode initial load).
  // Map.tsx uses this to show a centered spinner overlay.
  isInitialLoading: boolean;
  // True while any loadCampsites fetch is in flight (pan/zoom refetches).
  isFetching: boolean;
  // Exposed so Map.tsx can pre-populate cache from AI search response weather,
  // avoiding a redundant /api/weather/batch round-trip after results arrive.
  weatherCacheRef: MutableRefObject<Map<string, WeatherDay[] | null>>;
  loadCampsites: (map: mapboxgl.Map) => void;
  loadAmenities: (map: mapboxgl.Map) => void;
  // allCampsites is optional — omit to use campsitesRef.current (AI pan path in handleMoveEnd).
  loadWeatherForViewport: (map: mapboxgl.Map, allCampsites?: Campsite[]) => void;
  // Atomically updates campsites state, campsitesRef, and prevCampsitesLengthRef.
  // Use instead of setCampsites for AI-search result paths so all three stay in sync.
  setSearchResults: (campsites: Campsite[]) => void;
  // Call when AI search results are loaded directly (skips loadCampsites path).
  markInitialLoaded: () => void;
};

export function useMapData({
  drawerStateRef,
  activeFiltersRef,
  activeChipRef,
  selectedIdRef,
  cardRefs,
  skipNextFetch,
  setDrawerState,
  setSelectedIdx,
  setSelectedPoiId,
}: UseMapDataOptions): UseMapDataReturn {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [amenityPois, setAmenityPois] = useState<AmenityPOI[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Monotonic counter — discard results from stale in-flight requests
  const fetchCounterRef = useRef(0);
  // Separate counter for amenity fetches — same stale-discard pattern
  const amenityFetchCounterRef = useRef(0);
  // Separate counter for weather fetches — incremented before every weather batch
  // call (browse and AI search) so stale weather updates don't overwrite newer results.
  const weatherFetchCounterRef = useRef(0);
  // Tracks the previous fetch's result count so loadCampsites can detect 0 → results
  // transitions without calling a state setter inside another setter's updater function.
  const prevCampsitesLengthRef = useRef(0);
  // Client-side weather cache keyed by campsite ID — avoids re-fetching weather
  // for pins that have been seen this session. Server handles TTL/freshness.
  const weatherCacheRef = useRef<Map<string, WeatherDay[] | null>>(new Map());
  // Mirrors campsites state for stable callbacks (handleMoveEnd AI pan path).
  const campsitesRef = useRef<Campsite[]>([]);
  // Guards isInitialLoading so it only clears once (on first loadCampsites resolve).
  const hasInitiallyLoadedRef = useRef(false);

  // Keeps campsitesRef in sync with campsites state so stable callbacks
  // (loadWeatherForViewport default path) always read the latest list.
  useEffect(() => {
    campsitesRef.current = campsites;
  }, [campsites]);

  // Fetches weather only for campsite pins currently visible in the map viewport.
  // Applies the client-side cache immediately, then fetches uncached visible pins
  // from the server in the background.
  // allCampsites: explicit list (browse fetch, AI arrival). Omit to use campsitesRef.current
  // (handleMoveEnd AI pan path, where the ref is already current).
  const loadWeatherForViewport = useCallback(
    (map: mapboxgl.Map, allCampsites?: Campsite[]) => {
      const items = allCampsites ?? campsitesRef.current;
      if (items.length === 0) return;

      const bounds = computeVisibleBounds(map, getDrawerHeightPx(drawerStateRef.current));

      // Only fetch weather for visible pins not already in the client cache.
      // Longitude check assumes west < east (no antimeridian wrap). This is safe
      // for Australian coverage — the dateline (180°) sits east of NZ and is
      // never crossed by a normal AU map viewport.
      const uncached = items.filter(
        (c) =>
          !weatherCacheRef.current.has(c.id) &&
          c.lat <= bounds.north &&
          c.lat >= bounds.south &&
          c.lng >= bounds.west &&
          c.lng <= bounds.east
      );

      // Always set campsites with any cached weather applied. On first load (empty
      // cache) this is equivalent to setCampsites(items); on subsequent pans
      // it surfaces cached badges immediately without waiting for the async fetch.
      // Skipping this call when nothing is cached would leave browse-mode pins
      // invisible until the async updater runs against a stale prev list.
      setCampsites(
        items.map((c) =>
          weatherCacheRef.current.has(c.id)
            ? { ...c, weather: weatherCacheRef.current.get(c.id) ?? null }
            : c
        )
      );

      if (uncached.length === 0) return;

      // Pass the current date range so displayed weather days match the search window.
      // null/null in browse mode → extractWeatherForecast falls back to MAX_FORECAST_DAYS.
      const { startDate, endDate } = activeFiltersRef.current;

      const wid = ++weatherFetchCounterRef.current;
      // fetchWeatherBatch swallows all errors internally and always resolves —
      // no .catch() needed here.
      fetchWeatherBatch(uncached, startDate, endDate).then((fetched) => {
        if (wid !== weatherFetchCounterRef.current) return; // stale — a newer fetch superseded this
        // Only cache successful results — null means the fetch failed (network/5xx).
        // Leaving failed pins out of the cache allows them to be retried on the next pan.
        for (const c of fetched) {
          if (c.weather != null) {
            weatherCacheRef.current.set(c.id, c.weather);
          }
        }
        setCampsites((prev) => {
          const updated = prev.map((c) =>
            weatherCacheRef.current.has(c.id)
              ? { ...c, weather: weatherCacheRef.current.get(c.id) ?? null }
              : c
          );
          // When "Good weather" chip is active, only show campsites we have weather
          // data for — sites with no data (weather === null or undefined) can't be
          // confirmed as good-weather destinations, so they're excluded from the list.
          return activeChipRef.current === "weather"
            ? updated.filter((c) => c.weather != null)
            : updated;
        });
      });
    },
    // drawerStateRef, activeFiltersRef, activeChipRef are refs — stable references,
    // intentionally omitted from dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const markInitialLoaded = useCallback(() => {
    hasInitiallyLoadedRef.current = true;
    setIsInitialLoading(false);
  }, []);

  const loadCampsites = useCallback((map: mapboxgl.Map) => {
    const id = ++fetchCounterRef.current;
    setIsFetching(true);
    const bounds = computeVisibleBounds(map, getDrawerHeightPx(drawerStateRef.current));
    const filters = activeFiltersRef.current;
    const amenities = [...filters.activities, ...filters.pois];
    fetchCampsites(bounds, amenities)
      .then(({ results, hasMore: newHasMore }) => {
        if (id !== fetchCounterRef.current) return; // stale fetch — discard
        setIsFetching(false);
        markInitialLoaded();
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
        setHasMore(newHasMore);
        const newIdx = selectedIdRef.current
          ? results.findIndex((c) => c.id === selectedIdRef.current)
          : -1;
        setSelectedIdx(newIdx >= 0 ? newIdx : null);
        if (newIdx < 0) selectedIdRef.current = null;
        // loadWeatherForViewport sets campsites state (with cache applied) for non-empty
        // results. For empty results it returns early, so clear the list explicitly.
        if (results.length === 0) {
          setCampsites([]);
        } else {
          // Fetch weather only for visible pins not already cached client-side.
          // loadWeatherForViewport increments weatherFetchCounterRef internally, so
          // any in-flight fetch from a previous loadCampsites call is invalidated.
          loadWeatherForViewport(map, results);
        }
      })
      // fetchCampsites has an internal try/catch and always resolves — this .catch()
      // is a defensive guard in case that invariant ever changes (e.g. a future refactor
      // that lets network errors propagate).
      .catch(() => {
        if (id !== fetchCounterRef.current) return;
        setIsFetching(false);
        markInitialLoaded();
      });
  // drawerStateRef, activeFiltersRef, selectedIdRef, cardRefs, skipNextFetch are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWeatherForViewport, markInitialLoaded, setDrawerState, setSelectedIdx]);

  const setSearchResults = useCallback((newCampsites: Campsite[]) => {
    // Clear the initial overlay immediately so AI search arrivals and inline map
    // searches don't flash the spinner — covers both handleLoad and handleMapSearch paths.
    markInitialLoaded();
    setCampsites(newCampsites);
    campsitesRef.current = newCampsites;
    prevCampsitesLengthRef.current = newCampsites.length;
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
  // drawerStateRef, activeFiltersRef are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedPoiId]);

  return {
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
  };
}
