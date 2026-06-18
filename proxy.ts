import { type NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAME,
  SUPERADMIN_COOKIE_NAME,
  UNAUTHENTICATED_REDIRECT_PATH,
} from "@/lib/auth/constants";
import { resolveSessionFromToken } from "@/lib/auth/resolve-session-from-token";
import { verifySuperadminToken } from "@/lib/auth/superadmin-token";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/landing",
  "/privacy-policy",
  "/terms-and-conditions",
  "/api/login",
  "/api/signup",
  "/api/onboarding",
  "/api/logout",
  "/api/auth/logout",
  "/api/auth/2fa/verify",
  "/api/auth/callback",
  "/shopify",
  "/api/shopify",
  "/api/mcpServer",
  /** Stream queue reconcile (Bearer STREAM_QUEUE_RECONCILE_SECRET outside development). */
  "/api/public/stream-queue",
  /** Asset Intelligence microservice webhook (optional x-intel-secret). */
  "/api/receive-intel",
  /** HeyGen video agent webhook (optional x-heygen-secret). */
  "/api/heygen/webhook",
  /** Video download metadata for microservice (presigned R2 JSON). */
  "/api/videos",
] as const;

/** Public: GET /api/assets/{id}/download (not /url or /status). */
function isPublicAssetDownloadPath(pathname: string): boolean {
  return /^\/api\/assets\/[^/]+\/download$/.test(pathname);
}

function isPublicVideoDownloadPath(pathname: string): boolean {
  return /^\/api\/videos\/[^/]+\/download$/.test(pathname);
}

function isSuperadminPath(pathname: string): boolean {
  return (
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    pathname === "/api/superadmin" ||
    pathname.startsWith("/api/superadmin/")
  );
}

function isPublicPath(pathname: string): boolean {
  if (isPublicAssetDownloadPath(pathname)) return true;
  if (isPublicVideoDownloadPath(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

function clearSuperadminCookie(response: NextResponse) {
  response.cookies.delete(SUPERADMIN_COOKIE_NAME);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const superadminToken = request.cookies.get(SUPERADMIN_COOKIE_NAME)?.value;

  if (isSuperadminPath(pathname)) {
    if (!superadminToken) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const superadminSession = await verifySuperadminToken(superadminToken);
    if (!superadminSession) {
      const res = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        : NextResponse.redirect(new URL("/login", request.url));
      return clearSuperadminCookie(res);
    }

    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login" || pathname === "/signup") {
      if (superadminToken) {
        const superadminSession = await verifySuperadminToken(superadminToken);
        if (superadminSession) {
          return NextResponse.redirect(new URL("/superadmin/home", request.url));
        }
      }
      if (token) {
        const session = await resolveSessionFromToken(token);
        if (session) {
          return NextResponse.redirect(new URL("/home", request.url));
        }
        return clearSessionCookie(NextResponse.next());
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL(UNAUTHENTICATED_REDIRECT_PATH, request.url));
  }

  const session = await resolveSessionFromToken(token);
  if (!session) {
    return clearSessionCookie(
      NextResponse.redirect(new URL(UNAUTHENTICATED_REDIRECT_PATH, request.url)),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|lottie)$).*)",
  ],
};
