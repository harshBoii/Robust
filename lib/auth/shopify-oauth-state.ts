import { cookies } from "next/headers";
import { type NextRequest, type NextResponse } from "next/server";

export const SHOPIFY_OAUTH_STATE_COOKIE = "shopify_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type ShopifyOAuthStatePayload = {
  state: string;
  shop: string;
  companyId: string;
  createdAt: number;
};

export function createShopifyOAuthState(
  shop: string,
  companyId: string,
): ShopifyOAuthStatePayload {
  const state =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    state,
    shop,
    companyId,
    createdAt: Date.now(),
  };
}

export function setShopifyOAuthStateCookie(
  response: NextResponse,
  payload: ShopifyOAuthStatePayload,
  isProduction: boolean,
) {
  response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
  });
}

export function readShopifyOAuthStateFromRequest(
  request: NextRequest,
): ShopifyOAuthStatePayload | null {
  const raw = request.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ShopifyOAuthStatePayload;
    if (
      !parsed?.state ||
      !parsed?.shop ||
      !parsed?.companyId ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.createdAt > OAUTH_STATE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearShopifyOAuthStateCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SHOPIFY_OAUTH_STATE_COOKIE);
}

export function clearShopifyOAuthStateOnResponse(
  response: NextResponse,
) {
  response.cookies.delete(SHOPIFY_OAUTH_STATE_COOKIE);
}
