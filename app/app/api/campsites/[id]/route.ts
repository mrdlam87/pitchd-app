import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { SyncStatus } from "@/lib/generated/prisma/enums";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  try {
    const campsite = await prisma.campsite.findUnique({
      where: { id, syncStatus: SyncStatus.active },
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

    if (!campsite) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({
      ...campsite,
      amenities: campsite.amenities.map((a) => a.amenityType),
    });
  } catch (e) {
    console.error("[GET /api/campsites/[id]]", e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
