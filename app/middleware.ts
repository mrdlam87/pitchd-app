import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // Preview deployments: bypass auth entirely so the app is testable without
  // needing Google OAuth configured for every unique Vercel preview URL.
  // Set PREVIEW_BYPASS_AUTH=true in Vercel's Preview environment only — never in Production.
  if (process.env.PREVIEW_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  const { nextUrl, auth: session } = req;

  // Allow auth routes and public pages through unconditionally
  if (
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname === "/sign-in" ||
    nextUrl.pathname === "/access-denied"
  ) {
    return NextResponse.next();
  }

  // Unauthenticated — redirect to sign-in
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", nextUrl.origin));
  }

  // Authenticated but not invited — redirect to access-denied page
  if (session.user.role === "user") {
    return NextResponse.redirect(new URL("/access-denied", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
