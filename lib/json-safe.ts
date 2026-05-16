/** Recursively convert values that `JSON.stringify` cannot serialize (e.g. BigInt). */
export function jsonSafe<T>(v: T): T {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return String(v) as unknown as T;
  if (v instanceof Date) return v.toISOString() as unknown as T;
  if (Array.isArray(v)) return v.map((x) => jsonSafe(x)) as unknown as T;
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = jsonSafe(val);
    }
    return out as unknown as T;
  }
  return v;
}
