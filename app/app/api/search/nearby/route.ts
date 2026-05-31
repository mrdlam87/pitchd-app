import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const RESULT_LIMIT = 50;
const DEFAULT_RADIUS_KM = 100;
// Degrees per km at Australian latitudes (conservative overestimate for bounding box pre-filter).
const DEG_PER_KM = 1 / 100;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const free = searchParams.get("free") === "true";

  if (latParam === null || lngParam === null) {
    return Response.json({ error: "lat and lng are required" }, { status: 400 });
  }
  if (latParam.trim() === "" || lngParam.trim() === "") {
    return Response.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const lat = Number(latParam);
  const lng = Number(lngParam);

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: "lat and lng must be valid numbers" }, { status: 400 });
  }

  const pad = DEFAULT_RADIUS_KM * DEG_PER_KM;

  try {
    const campsites = await prisma.campsite.findMany({
      where: {
        syncStatus: SyncStatus.active,
        lat: { gte: lat - pad, lte: lat + pad },
        lng: { gte: lng - pad, lte: lng + pad },
        ...(free && { isFree: true }),
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        region: true,
        blurb: true,
        amenities: {
          select: {
            amenityType: {
              select: { key: true, label: true, icon: true, color: true },
            },
          },
        },
      },
    });

    const filtered = campsites
      .map((c) => ({ c: { ...c, amenities: c.amenities.map((a) => a.amenityType) }, d: haversineKm(lat, lng, c.lat, c.lng) }))
      .filter(({ d }) => d <= DEFAULT_RADIUS_KM)
      .sort((a, b) => a.d - b.d);

    const hasMore = filtered.length > RESULT_LIMIT;
    const page = filtered.slice(0, RESULT_LIMIT);

    return Response.json({ campsites: page.map(({ c }) => c), hasMore });
  } catch (e) {
    console.error("[GET /api/search/nearby]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
