// GET /api/campsites
// Browse mode — returns campsites within an exact viewport bounding box (north/south/east/west).
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

const PAGE_SIZE = 200;

// Guard against full-table scans from very large viewports.
// ~1,100 km N-S and ~1,350 km E-W at 30°S — matches minZoom=7 on the client.
const MAX_LAT_SPAN = 10;
const MAX_LNG_SPAN = 15;

export async function GET(req: Request): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);

  // Number() is stricter than parseFloat() — rejects partial strings like "123abc".
  // || NaN handles null/empty-string (missing param) since Number(null) and Number("") both return 0.
  const north = Number(searchParams.get("north") || NaN);
  const south = Number(searchParams.get("south") || NaN);
  const east  = Number(searchParams.get("east")  || NaN);
  const west  = Number(searchParams.get("west")  || NaN);
  // Guard against non-numeric page values (parseInt("abc") = NaN; NaN || 1 = 1)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  // filter(Boolean) drops empty strings from ?amenities= (no value) to avoid matching nothing
  const amenities = searchParams.getAll("amenities").filter(Boolean);

  if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
    return Response.json(
      { error: "north, south, east, and west are required" },
      { status: 400 }
    );
  }

  if (
    north < -90 || north > 90 ||
    south < -90 || south > 90 ||
    east  < -180 || east  > 180 ||
    west  < -180 || west  > 180
  ) {
    return Response.json(
      { error: "coordinates out of range" },
      { status: 400 }
    );
  }

  if (south >= north || west >= east) {
    return Response.json(
      { error: "south must be less than north, west must be less than east" },
      { status: 400 }
    );
  }

  if ((north - south) > MAX_LAT_SPAN || (east - west) > MAX_LNG_SPAN) {
    return Response.json({ error: "bounding box too large" }, { status: 400 });
  }

  try {
    // Index note: @@index([syncStatus, lat, lng]) — Postgres can range-scan on syncStatus+lat
    // but not on lng (second range column in a B-tree). lng is included as a covering hint
    // to avoid heap fetches on some query plans.
    // Note: antimeridian wrapping (east < west) is not handled — not a concern for Australian campsites.
    const campsites = await prisma.campsite.findMany({
      where: {
        syncStatus: SyncStatus.active,
        lat: { gte: south, lte: north },
        lng: { gte: west,  lte: east  },
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
      // Secondary sort on id ensures deterministic pagination when names are identical
      orderBy: [{ name: "asc" }, { id: "asc" }],
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
