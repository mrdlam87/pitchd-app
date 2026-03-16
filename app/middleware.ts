import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
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
