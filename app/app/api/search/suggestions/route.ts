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
    return Response.json({ suggestions: [] }, { status: 400 });
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

    // Resolve a representative state for each region group via a single per-region lookup.
    // groupBy doesn't expose non-grouped columns, so we fetch one campsite per region.
    const regions: RegionSuggestion[] = await Promise.all(
      regionGroups.map(async (g) => {
        const sample = await prisma.campsite.findFirst({
          where: { region: g.region! },
          select: { state: true },
        });
        return {
          kind: "region" as const,
          name: g.region!,
          count: g._count.region,
          state: sample?.state ?? "",
        };
      })
    );

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
