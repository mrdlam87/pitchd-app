// GET /api/campsites
// Browse mode — returns campsites within a viewport (lat, lng, radius in km)
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const PAGE_SIZE = 20;
const MAX_RADIUS_KM = 250;

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "");
  // Guard against non-numeric page values (parseInt("abc") = NaN; NaN || 1 = 1)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const amenities = searchParams.getAll("amenities");

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    return Response.json(
      { error: "lat, lng, and radius are required" },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return Response.json(
      { error: "lat must be between -90 and 90, lng between -180 and 180" },
      { status: 400 }
    );
  }

  if (radius <= 0 || radius > MAX_RADIUS_KM) {
    return Response.json(
      { error: `radius must be greater than 0 and at most ${MAX_RADIUS_KM} km` },
      { status: 400 }
    );
  }

  // Bounding box approximation: 1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat)
  // radius param is in km. cos clamped to avoid division by zero at ±90°.
  // Note: antimeridian wrapping (lng ± lngDelta overflowing ±180°) is not handled —
  // not a concern for Australian campsites.
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.001));

  try {
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
        // state is intentionally excluded — not required by this endpoint's response spec
        amenities: {
          select: {
            amenityType: {
              select: {
                key: true,
                label: true,
                icon: true,
                color: true,
                // category is intentionally excluded — not required by this endpoint's response spec
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const results = campsites.map((c) => ({
      ...c,
      amenities: c.amenities.map((a) => a.amenityType),
    }));

    return Response.json({
      results,
      page,
      pageSize: PAGE_SIZE,
      // Note: hasMore uses length === PAGE_SIZE as a cheap heuristic (avoids COUNT query).
      // If exactly PAGE_SIZE records remain, the client will make one extra empty request.
      hasMore: campsites.length === PAGE_SIZE,
    });
  } catch (e) {
    console.error("[GET /api/campsites]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
