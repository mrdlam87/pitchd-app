import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const RESULT_LIMIT = 100;

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
  const name = (searchParams.get("name") ?? "").trim();
  const free = searchParams.get("free") === "true";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const userLat = latParam !== null ? Number(latParam) : NaN;
  const userLng = lngParam !== null ? Number(lngParam) : NaN;
  const hasLocation = !isNaN(userLat) && !isNaN(userLng);

  try {
    const campsites = await prisma.campsite.findMany({
      where: {
        syncStatus: SyncStatus.active,
        region: { contains: name, mode: "insensitive" },
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
      take: RESULT_LIMIT,
    });

    const results = campsites.map((c) => ({
      ...c,
      amenities: c.amenities.map((a) => a.amenityType),
    }));

    if (hasLocation) {
      results.sort(
        (a, b) =>
          haversineKm(userLat, userLng, a.lat, a.lng) -
          haversineKm(userLat, userLng, b.lat, b.lng)
      );
    }

    return Response.json({ campsites: results });
  } catch (e) {
    console.error("[GET /api/search/region]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
