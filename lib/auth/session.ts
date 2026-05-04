import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    return {
      companyId: payload.sub!,        // set as subject in signSessionToken
      userName: payload.userName as string,
      slug: payload.slug as string,
    };
  } catch {
    return null;
  }
}