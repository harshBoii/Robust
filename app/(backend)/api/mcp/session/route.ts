import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { authCookieMaxAge, verifySessionToken } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("t") ?? "";
  const next = url.searchParams.get("next") ?? "/create-ad";

  if (!t) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    await verifySessionToken(t);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set(AUTH_COOKIE_NAME, t, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authCookieMaxAge(),
  });
  return res;
}

