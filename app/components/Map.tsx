"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.warn("[MapView] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
}

// Default centre: roughly the middle of Australia
const DEFAULT_VIEWPORT = {
  longitude: 134.0,
  latitude: -25.5,
  zoom: 4,
};

// Design tokens
const FOREST_GREEN = "#2d4a2d";
const SURFACE = "#f7f5f0";
const CORAL = "#e8674a";

type Campsite = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  blurb: string | null;
  // amenities populated in M4 — always returned by the API but not yet used in UI
  amenities: { key: string; label: string; icon: string; color: string }[];
};

type FetchResult = { results: Campsite[]; hasMore: boolean };

async function fetchCampsites(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<FetchResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(Math.min(Math.max(radiusKm, 1), 250)),
  });
  try {
    const res = await fetch(`/api/campsites?${params}`);
    if (!res.ok) return { results: [], hasMore: false };
    const data = await res.json();
    return { results: data.results ?? [], hasMore: data.hasMore ?? false };
  } catch {
    return { results: [], hasMore: false };
  }
}

function computeRadius(map: mapboxgl.Map): number {
  const bounds = map.getBounds();
  if (!bounds) return 250;
  const latSpan = (bounds.getNorth() - bounds.getSouth()) / 2;
  const lngSpan = (bounds.getEast() - bounds.getWest()) / 2;
  // Apply cos(lat) correction — at ~30°S, 1° lng ≈ 96 km not 111 km
  const centerLat = (bounds.getNorth() + bounds.getSouth()) / 2;
  const latSpanKm = latSpan * 111;
  const lngSpanKm = lngSpan * 111 * Math.cos((centerLat * Math.PI) / 180);
  return Math.sqrt(latSpanKm ** 2 + lngSpanKm ** 2);
}

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipNextFetch = useRef(false);
  // Monotonic counter — discard results from stale in-flight requests
  const fetchCounterRef = useRef(0);

  // Request user geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {
        /* denied or unavailable — no-op */
      }
    );
  }, []);

  const loadCampsites = useCallback((map: mapboxgl.Map) => {
    const id = ++fetchCounterRef.current;
    const center = map.getCenter();
    const radius = computeRadius(map);
    fetchCampsites(center.lat, center.lng, radius).then(({ results, hasMore }) => {
      if (id !== fetchCounterRef.current) return; // stale fetch — discard
      setCampsites(results);
      setHasMore(hasMore);
      setSelectedIdx(null);
    });
  }, []);

  const handleLoad = useCallback(
    (e: { target: mapboxgl.Map }) => loadCampsites(e.target),
    [loadCampsites]
  );

  const handleMoveEnd = useCallback(
    (e: { target: mapboxgl.Map }) => {
      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      loadCampsites(e.target);
    },
    [loadCampsites]
  );

  function selectPin(i: number) {
    setSelectedIdx(i);
    // Pan map to the selected campsite — skip the refetch that onMoveEnd would trigger
    const campsite = campsites[i];
    if (campsite && mapRef.current) {
      skipNextFetch.current = true;
      mapRef.current.easeTo({
        center: [campsite.lng, campsite.lat],
        duration: 300,
      });
    }
    // Scroll the matching card into view after state settles
    requestAnimationFrame(() => {
      cardRefs.current[i]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  const resultLabel =
    campsites.length === 0
      ? ""
      : hasMore
      ? `${campsites.length}+ campsites nearby`
      : `${campsites.length} campsites nearby`;

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        mapLib={mapboxgl}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={DEFAULT_VIEWPORT}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
      >
        {/* User location dot */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: CORAL,
                border: "2.5px solid #fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            />
          </Marker>
        )}

        {/* Campsite pins */}
        {campsites.map((campsite, i) => {
          const isSel = selectedIdx === i;
          const sz = isSel ? 38 : 28;
          const shortName = campsite.name
            .replace(" National Park", " NP")
            .replace(" Conservation Park", " CP")
            .split(" – ")[0];
          return (
            <Marker
              key={campsite.id}
              longitude={campsite.lng}
              latitude={campsite.lat}
              anchor="bottom"
              style={{ zIndex: isSel ? 10 : 1 }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  selectPin(i);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    width: sz,
                    height: sz,
                    borderRadius: "50%",
                    background: isSel ? FOREST_GREEN : SURFACE,
                    border: `2.5px solid ${FOREST_GREEN}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: isSel ? 13 : 10,
                    color: isSel ? "#fff" : FOREST_GREEN,
                    fontFamily: "DM Sans, sans-serif",
                    transition: "all 0.15s ease",
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    background: "rgba(0,0,0,0.72)",
                    borderRadius: 8,
                    padding: "3px 8px",
                    maxWidth: 110,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: isSel ? 11 : 10,
                    fontWeight: isSel ? 700 : 600,
                    color: "#fff",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  {shortName}
                </div>
              </div>
            </Marker>
          );
        })}
      </MapGL>

      {/* Bottom drawer — z-index must exceed marker z-index (max 10) to prevent bleed-through */}
      {campsites.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl flex flex-col"
          style={{
            background: SURFACE,
            maxHeight: "40vh",
            borderTop: "1.5px solid #e0dbd0",
            zIndex: 50,
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: "#e0dbd0" }}
            />
          </div>

          {/* Result count */}
          <div
            className="px-4 pb-2 text-sm font-semibold flex-shrink-0"
            style={{ color: FOREST_GREEN }}
          >
            {resultLabel}
          </div>

          {/* Scrollable card list */}
          <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
            {campsites.map((campsite, i) => {
              const isSel = selectedIdx === i;
              return (
                <div
                  key={campsite.id}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onClick={() => selectPin(i)}
                  className="rounded-xl p-3 cursor-pointer"
                  style={{
                    border: isSel
                      ? `1.5px solid ${CORAL}`
                      : "1.5px solid #e0dbd0",
                    background: isSel ? "#fff" : SURFACE,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Index badge */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        background: isSel ? FOREST_GREEN : "transparent",
                        border: `2px solid ${FOREST_GREEN}`,
                        color: isSel ? "#fff" : FOREST_GREEN,
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "DM Sans, sans-serif",
                      }}
                    >
                      {i + 1}
                    </div>
                    {/* Name + region */}
                    <div className="min-w-0">
                      <div
                        className="font-semibold text-sm truncate"
                        style={{ color: FOREST_GREEN }}
                      >
                        {campsite.name}
                      </div>
                      {campsite.region && (
                        <div
                          className="text-xs truncate"
                          style={{ color: "#5a7a5a" }}
                        >
                          {campsite.region}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
