import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "./constants";

/** Clears the session cookie and returns a small JSON body. */
export function logoutJsonResponse(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
