export function normalizeSiteUrlForPublish(url: string): string {
  try {
    const u = new URL(url.replace(/\/+$/, ""));
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}
