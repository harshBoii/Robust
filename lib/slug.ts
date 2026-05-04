/** URL-safe slug for Company.slug; ensures non-empty fallback. */
export function slugifyName(name: string, suffix?: string): string {
  let base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);

  if (!base) base = "company";
  return suffix ? `${base}-${suffix}` : base;
}
