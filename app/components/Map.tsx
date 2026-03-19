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
import type { AmenityPOI, Campsite } from "@/types/map";
import { CORAL, FOREST_GREEN } from "@/lib/tokens";

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

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [amenityPois, setAmenityPois] = useState<AmenityPOI[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("peek");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Ref mirrors state so loadCampsites always reads the latest filters without
  // needing activeFilters as a dependency (the callback is stable).
  const activeFiltersRef = useRef<FilterState>(EMPTY_FILTERS);
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
        if (mapLoadedRef.current) {
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
    if (mapRef.current && mapLoadedRef.current) {
      // skipNextFetch suppresses the moveend that setPadding fires internally
      skipNextFetch.current = true;
      mapRef.current.getMap().setPadding({ top: 0, right: 0, bottom: getDrawerHeightPx(state), left: 0 });
    }
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
      setShowFilters(false);
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        loadCampsites(map);
        loadAmenities(map);
      }
    },
    [loadCampsites, loadAmenities],
  );

  const filterCount = activeFilters.activities.length + activeFilters.pois.length;

  const showDrawer = campsites.length > 0 || selectedPoiId !== null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Filter panel overlay */}
      {showFilters && (
        <FilterPanel
          initialFilters={activeFilters}
          onApply={handleApplyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Floating Filters button — z-[60] must exceed drawer (z-50) to stay clickable */}
      <div className="absolute top-3 right-3 z-[60]">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shadow-md transition-opacity hover:opacity-90 active:opacity-70"
          style={{
            background: filterCount > 0 ? CORAL : "#fff",
            color: filterCount > 0 ? "#fff" : FOREST_GREEN,
            border: `1.5px solid ${filterCount > 0 ? CORAL : "#e0dbd0"}`,
            fontFamily: "var(--font-dm-sans), sans-serif",
          }}
          aria-label={`Filters${filterCount > 0 ? ` (${filterCount} active)` : ""}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18M7 12h10M11 18h2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Filters
          {filterCount > 0 && (
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(255,255,255,0.3)" }}
            >
              {filterCount}
            </span>
          )}
        </button>
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
