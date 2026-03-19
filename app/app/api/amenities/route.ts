// GET /api/amenities
// Returns standalone AmenityPOI pins within a radius of a given coordinate.
// Params: lat, lng, radius (km), type (AmenityType key)
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 1 degree of latitude ≈ 111.32 km everywhere.
// 1 degree of longitude ≈ 111.32 * cos(lat) km — varies with latitude.
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

  if (lat < -90 || lat > 90) {
    return Response.json({ error: "lat out of range" }, { status: 400 });
  }

  if (lng < -180 || lng > 180) {
    return Response.json({ error: "lng out of range" }, { status: 400 });
  }

  if (radius <= 0 || radius > MAX_RADIUS_KM) {
    return Response.json(
      { error: `radius must be between 0 and ${MAX_RADIUS_KM}` },
      { status: 400 }
    );
  }

  if (!type) {
    return Response.json({ error: "type is required" }, { status: 400 });
  }

  const { minLat, maxLat, minLng, maxLng } = boundingBox(lat, lng, radius);

  try {
    const pois = await prisma.amenityPOI.findMany({
      where: {
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
        amenityType: { key: type },
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        amenityTypeId: true,
      },
      orderBy: { id: "asc" },
    });

    return Response.json(pois);
  } catch (e) {
    console.error("[GET /api/amenities]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
