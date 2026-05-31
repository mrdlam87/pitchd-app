import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 4;
const LOCATION_LIMIT = 2;
const MAX_TOTAL_SUGGESTIONS = 7;

export type CampsiteSuggestion = {
  kind: "campsite";
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  state: string;
};

export type RegionSuggestion = {
  kind: "region";
  name: string;
  count: number;
  state: string;
};

export type LocationSuggestion = {
  kind: "location";
  name: string;
  lat: number;
  lng: number;
};

export type Suggestion = CampsiteSuggestion | RegionSuggestion | LocationSuggestion;

async function fetchLocationSuggestions(q: string): Promise<LocationSuggestion[]> {
  // Prefer MAPBOX_SERVER_TOKEN (server-only, not in client bundle or URL logs).
  // Fall back to NEXT_PUBLIC_MAPBOX_TOKEN for environments that only set the public var.
  const token = process.env.MAPBOX_SERVER_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return [];
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=AU&types=place,locality,neighborhood&limit=${LOCATION_LIMIT}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return [];
    const data = await res.json() as { features?: Array<{ text: string; center: [number, number] }> };
    if (!Array.isArray(data.features)) return [];
    return data.features
      .filter((f) => f.text && Array.isArray(f.center) && f.center.length >= 2)
      .map((f) => ({ kind: "location" as const, name: f.text, lat: f.center[1], lng: f.center[0] }));
  } catch {
    return [];
  }
}

export async function GET(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return Response.json({ suggestions: [] });
  }

  try {
    const [campsites, regionGroups, locationSuggestions] = await Promise.all([
      prisma.campsite.findMany({
        where: {
          syncStatus: SyncStatus.active,
          name: { contains: q, mode: "insensitive" },
        },
        select: { id: true, name: true, lat: true, lng: true, region: true, state: true },
        orderBy: { name: "asc" },
        take: SUGGESTION_LIMIT,
      }),
      prisma.campsite.groupBy({
        by: ["region", "state"],
        where: {
          syncStatus: SyncStatus.active,
          region: { not: null, contains: q, mode: "insensitive" },
        },
        _count: { region: true },
        orderBy: { _count: { region: "desc" } },
        take: SUGGESTION_LIMIT,
      }),
      fetchLocationSuggestions(q),
    ]);

    const regions: RegionSuggestion[] = regionGroups.map((g) => ({
      kind: "region" as const,
      name: g.region!,
      count: g._count.region,
      state: g.state,
    }));

    const campsiteSuggestions: CampsiteSuggestion[] = campsites.map((c) => ({
      kind: "campsite" as const,
      ...c,
    }));

    // Locations first (city-level intent), then regions, then campsites. Cap total.
    const suggestions: Suggestion[] = [...locationSuggestions, ...regions, ...campsiteSuggestions].slice(0, MAX_TOTAL_SUGGESTIONS);

    return Response.json({ suggestions });
  } catch (e) {
    console.error("[GET /api/search/suggestions]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
