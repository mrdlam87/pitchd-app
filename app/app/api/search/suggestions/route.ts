import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 4;
const LOCATION_LIMIT = 2;

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
  // TODO: use a dedicated MAPBOX_SERVER_TOKEN (no NEXT_PUBLIC_ prefix) to avoid
  // leaking the token in server-side request logs if scope ever changes.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return [];
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=AU&types=place,locality,neighborhood&limit=${LOCATION_LIMIT}&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
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

    // Locations first (city-level intent), then regions, then campsites.
    const suggestions: Suggestion[] = [...locationSuggestions, ...regions, ...campsiteSuggestions];

    return Response.json({ suggestions });
  } catch (e) {
    console.error("[GET /api/search/suggestions]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
