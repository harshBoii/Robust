/**
 * Normalize a shop input to *.myshopify.com
 */
export function normalizeShopDomain(raw: string): string {
  let shop = raw.trim().toLowerCase();
  if (!shop) return "";

  shop = shop.replace(/^https?:\/\//, "");
  shop = shop.split("/")[0] ?? shop;
  shop = shop.replace(/\.myshopify\.com$/i, "");

  if (!shop || !/^[a-z0-9][a-z0-9-]*$/i.test(shop)) {
    return "";
  }

  return `${shop}.myshopify.com`;
}
