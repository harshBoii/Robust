import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { resolveSessionFromToken } from "@/lib/auth/resolve-session-from-token";
import { touchAuthSession } from "@/lib/auth/session-store";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await resolveSessionFromToken(token);
  if (!session) return null;

  void touchAuthSession(session.sessionId);
  return session;
}
