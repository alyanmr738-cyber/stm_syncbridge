import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { AdminSession } from "@/lib/auth/session";

const publicPaths = [
  "/login",
  "/api/webhooks",
  "/api/health",
  "/api/auth",
  "/api/oauth",
  "/api/internal/process-queue",
];

function isPublic(pathname: string): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }

  const secret =
    process.env.ADMIN_SESSION_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "development-only-syncbridge-session-secret-32chars"
      : undefined);

  if (!secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  const session = await getIronSession<AdminSession>(request, response, {
    password: secret,
    cookieName: "syncbridge_admin",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  });

  if (!session.isLoggedIn && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
