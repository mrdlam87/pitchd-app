"use client";

import mapboxgl from "mapbox-gl";
import MapGL, { Marker } from "react-map-gl/mapbox";
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
};

async function fetchCampsites(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Campsite[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(Math.min(Math.max(radiusKm, 1), 250)),
  });
  try {
    const res = await fetch(`/api/campsites?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

function computeRadius(map: mapboxgl.Map): number {
  const bounds = map.getBounds();
  if (!bounds) return 250;
  const latSpan = (bounds.getNorth() - bounds.getSouth()) / 2;
  const lngSpan = (bounds.getEast() - bounds.getWest()) / 2;
  // Haversine approximation: 1° ≈ 111km, diagonal from centre to corner
  return Math.sqrt(latSpan ** 2 + lngSpan ** 2) * 111;
}

export default function MapView() {
  const [campsites, setCampsites] = useState<Campsite[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    const center = map.getCenter();
    const radius = computeRadius(map);
    fetchCampsites(center.lat, center.lng, radius).then((results) => {
      setCampsites(results);
      setSelectedIdx(null);
    });
  }, []);

  function handleLoad(e: mapboxgl.MapboxEvent) {
    loadCampsites(e.target);
  }

  function handleMoveEnd(e: mapboxgl.MapboxEvent) {
    loadCampsites(e.target);
  }

  function selectPin(i: number) {
    setSelectedIdx(i);
    // Scroll the matching card into view after state settles
    requestAnimationFrame(() => {
      cardRefs.current[i]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  return (
    <div className="relative h-full w-full">
      <MapGL
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
          return (
            <Marker
              key={campsite.id}
              longitude={campsite.lng}
              latitude={campsite.lat}
              style={{ zIndex: isSel ? 10 : 1 }}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  selectPin(i);
                }}
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
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "all 0.15s ease",
                }}
              >
                {i + 1}
              </div>
            </Marker>
          );
        })}
      </MapGL>

      {/* Bottom drawer */}
      {campsites.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-2xl flex flex-col"
          style={{
            background: SURFACE,
            maxHeight: "40vh",
            borderTop: "1.5px solid #e0dbd0",
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
            {campsites.length} campsites nearby
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
                        <div className="text-xs truncate" style={{ color: "#5a7a5a" }}>
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
