// GET /api/amenities
// Returns standalone AmenityPOI pins within a radius of a given coordinate.
// Params: lat, lng, radius (km), type (AmenityType key)
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 1 degree of latitude ≈ 111.32 km everywhere.
// 1 degree of longitude ≈ 111.32 * cos(lat) km — varies with latitude.
// Note: the filter is a lat/lng bounding box, not a true circle — POIs in the corners
// can be up to ~41% further than radius km from the centre.
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const deltaLat = radiusKm / 111.32;
  const deltaLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLng: lng - deltaLng,
    maxLng: lng + deltaLng,
  };
}

const MAX_RADIUS_KM = 500;
// Hard cap to avoid returning thousands of rows at large radii from a well-seeded DB.
const MAX_RESULTS = 200;

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // Number() is stricter than parseFloat() — rejects partial strings like "123abc".
  // || NaN handles null/empty-string (missing param) since Number(null) and Number("") both return 0.
  const lat    = Number(searchParams.get("lat")    || NaN);
  const lng    = Number(searchParams.get("lng")    || NaN);
  const radius = Number(searchParams.get("radius") || NaN);
  const type   = searchParams.get("type");

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    return Response.json(
      { error: "lat, lng, and radius are required" },
      { status: 400 }
    );
  }

  // Exclude poles: Math.cos(±π/2) ≈ 6e-17, which makes deltaLng effectively infinite.
  if (lat <= -90 || lat >= 90) {
    return Response.json({ error: "lat out of range" }, { status: 400 });
  }

  if (lng < -180 || lng > 180) {
    return Response.json({ error: "lng out of range" }, { status: 400 });
  }

  if (radius <= 0 || radius > MAX_RADIUS_KM) {
    return Response.json(
      { error: `radius must be > 0 and ≤ ${MAX_RADIUS_KM}` },
      { status: 400 }
    );
  }

  if (!type) {
    return Response.json({ error: "type is required" }, { status: 400 });
  }

  try {
    // Resolve amenityTypeId from the key first so we can filter directly on the indexed column.
    // This lets Postgres use @@index([amenityTypeId, lat, lng]) instead of planning a JOIN.
    // Returns 400 for an unknown key — a valid type with no nearby POIs returns [] via findMany.
    const amenityType = await prisma.amenityType.findUnique({
      where: { key: type },
      select: { id: true },
    });

    if (!amenityType) {
      return Response.json({ error: `Unknown amenity type: ${type}` }, { status: 400 });
    }

    const { minLat, maxLat, minLng, maxLng } = boundingBox(lat, lng, radius);

    const pois = await prisma.amenityPOI.findMany({
      where: {
        amenityTypeId: amenityType.id,
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        amenityType: { select: { key: true } },
      },
      orderBy: { id: "asc" },
      // Fetch one extra to detect truncation without an extra COUNT query.
      take: MAX_RESULTS + 1,
    });

    const truncated = pois.length > MAX_RESULTS;
    const results = truncated ? pois.slice(0, MAX_RESULTS) : pois;

    return Response.json({ results, truncated });
  } catch (e) {
    console.error("[GET /api/amenities]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
