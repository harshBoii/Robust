import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Shopify HMAC on query string params (excludes `hmac` param).
 */
export function verifyHmacFromSearchParams(
  searchParams: URLSearchParams,
  secret: string,
): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac || !secret) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "hmac" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const message = pairs.join("&");

  const digest = createHmac("sha256", secret).update(message).digest("hex");

  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmac, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
