// GET /api/campsites
// Browse mode — returns campsites within a viewport (lat, lng, radius)
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const amenities = searchParams.getAll("amenities[]");

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    return Response.json(
      { error: "lat, lng, and radius are required" },
      { status: 400 }
    );
  }

  // Bounding box approximation: 1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat)
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

  const campsites = await prisma.campsite.findMany({
    where: {
      syncStatus: SyncStatus.active,
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
      ...(amenities.length > 0 && {
        amenities: {
          some: {
            amenityType: {
              key: { in: amenities },
            },
          },
        },
      }),
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
            select: {
              key: true,
              label: true,
              icon: true,
              color: true,
            },
          },
        },
      },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const results = campsites.map((c) => ({
    ...c,
    amenities: c.amenities.map((a) => a.amenityType),
  }));

  return Response.json(results);
}
