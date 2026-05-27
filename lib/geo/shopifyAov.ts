type MoneyLike = string | number | { toString(): string } | null | undefined;

export function parseMoney(value: MoneyLike): number | null {
  if (value == null) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function medianCompanyAovFromProducts(
  products: Array<{ priceMinAmount: MoneyLike; priceMaxAmount: MoneyLike }>,
  fallback: number | null = 75,
): number | null {
  const midpoints: number[] = [];
  for (const p of products) {
    const min = parseMoney(p.priceMinAmount);
    const max = parseMoney(p.priceMaxAmount);
    if (min != null && max != null) {
      midpoints.push(min === max ? min : (min + max) / 2);
    } else if (min != null) midpoints.push(min);
    else if (max != null) midpoints.push(max);
  }
  if (midpoints.length === 0) return fallback;
  const sorted = [...midpoints].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
