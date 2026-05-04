import { type NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/api/login",
  "/api/signup",
  "/api/logout",
] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" || pathname === "/signup") {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        try {
          await verifySessionToken(token);
          return NextResponse.redirect(new URL("/", request.url));
        } catch {
          const res = NextResponse.next();
          res.cookies.delete(AUTH_COOKIE_NAME);
          return res;
        }
      }
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifySessionToken(token);
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|lottie)$).*)",
  ],
};
