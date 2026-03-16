import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // Allow auth routes through unconditionally
  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Unauthenticated — redirect to sign-in
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/signin", nextUrl.origin));
  }

  // Authenticated but not invited — show 403
  if (session.user.role === "user") {
    return new NextResponse("Access restricted to invited users.", {
      status: 403,
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
