import { cache } from "react";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { resolveSessionFromToken } from "@/lib/auth/resolve-session-from-token";
import { touchAuthSession } from "@/lib/auth/session-store";

/** Only rewrite auth_sessions.lastSeenAt when it's older than this. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Per-request memoized: the layout, page and any nested server components share one
 * session lookup instead of each hitting the database.
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await resolveSessionFromToken(token);
  if (!session) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    void touchAuthSession(session.sessionId).catch(() => {});
  }
  return session;
});
