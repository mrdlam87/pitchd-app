// Shared auth guard for API route handlers.
// Returns a 401 Response if the request is not authenticated, or null if it should proceed.
//
// Preview bypass: when PREVIEW_BYPASS_AUTH=true and VERCEL_ENV !== "production",
// auth is skipped entirely so preview deployments are testable without Google OAuth.
// Uses VERCEL_ENV (not NODE_ENV) because Vercel sets NODE_ENV=production on both
// production and preview deployments.
import { auth } from "@/auth";

export async function requireAuth(): Promise<Response | null> {
  if (process.env.PREVIEW_BYPASS_AUTH === "true" && process.env.VERCEL_ENV !== "production") {
    return null;
  }
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
