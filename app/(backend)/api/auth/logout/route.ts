import { logoutJsonResponse } from "@/lib/auth/logout-response";

/** Alias of `POST /api/logout` for clients that prefer `/api/auth/*` routing. */
export async function POST() {
  return logoutJsonResponse();
}
