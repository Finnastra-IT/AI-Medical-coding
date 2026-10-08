import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "medicode_session";

// Lightweight, Edge-compatible gate: only checks whether the session cookie
// is PRESENT, never whether it's actually valid — Edge middleware can't open
// a raw TCP connection to Postgres, so real validation (session exists,
// unexpired, user still active) can't happen here. That real check happens
// server-side in `(protected)/layout.tsx` and in every API route via
// `getSessionUser()`/`requireAdminUser()` (Node runtime, where `pg` works
// fine) — see AGENTS.md "Authentication & admin user management" for the
// full picture. This middleware exists only to bounce an obviously
// logged-out visitor to /login before a protected page even starts
// rendering; don't mistake it for the actual security boundary.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  if (hasSessionCookie) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
