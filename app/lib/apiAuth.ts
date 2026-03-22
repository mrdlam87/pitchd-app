// Shared auth guard for API route handlers.
// Returns a 401/403 Response if the request fails auth, or null if it should proceed.
//
// Note: middleware.ts already gates all page routes — this guard covers API routes which
// call auth() independently of middleware. Keep both bypass conditions in sync if the
// PREVIEW_BYPASS_AUTH logic ever changes.
//
// Preview bypass: when PREVIEW_BYPASS_AUTH=true and VERCEL_ENV !== "production",
// auth is skipped for routes that don't require a specific role. Role-gated routes
// (e.g. admin) are NOT bypassed — previews must test role checks, not skip them.
// Uses VERCEL_ENV (not NODE_ENV) because Vercel sets NODE_ENV=production on both
// production and preview deployments.
import { auth } from "@/auth";
import { UserRole } from "@/lib/generated/prisma/enums";

export async function requireAuth(requiredRole?: UserRole): Promise<Response | null> {
  if (!requiredRole && process.env.PREVIEW_BYPASS_AUTH === "true" && process.env.VERCEL_ENV !== "production") {
    return null;
  }
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (requiredRole && session.user.role !== requiredRole) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
