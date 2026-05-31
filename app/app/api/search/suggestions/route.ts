// GET /api/search/suggestions
// Prefix-match campsites and regions for typeahead suggestions.
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 4;

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

export type Suggestion = CampsiteSuggestion | RegionSuggestion;

export async function GET(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return Response.json({ suggestions: [] });
  }

  try {
    const [campsites, regionGroups] = await Promise.all([
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
        by: ["region"],
        where: {
          syncStatus: SyncStatus.active,
          region: { not: null, contains: q, mode: "insensitive" },
        },
        _count: { region: true },
        orderBy: { _count: { region: "desc" } },
        take: SUGGESTION_LIMIT,
      }),
    ]);

    // Resolve a representative state for each region group. Scoped to the exact
    // regions from the first query so ordering differences can't produce misses.
    const regionStates = await prisma.campsite.groupBy({
      by: ["region", "state"],
      where: {
        syncStatus: SyncStatus.active,
        region: { in: regionGroups.map((g) => g.region!) },
      },
    });
    const stateMap = new Map(
      regionStates.map((r: { region: string | null; state: string }) => [r.region!, r.state])
    );

    const regions: RegionSuggestion[] = regionGroups.map((g) => ({
      kind: "region" as const,
      name: g.region!,
      count: g._count.region,
      state: stateMap.get(g.region!) ?? "",
    }));

    const campsiteSuggestions: CampsiteSuggestion[] = campsites.map((c) => ({
      kind: "campsite" as const,
      ...c,
    }));

    // Regions first, then campsites — regions are broader and more useful for navigation.
    const suggestions: Suggestion[] = [...regions, ...campsiteSuggestions];

    return Response.json({ suggestions });
  } catch (e) {
    console.error("[GET /api/search/suggestions]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
