import type { OfferingType } from '@/app/generated/prisma/client';

export function parseStringArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function trimOptionalString(v: unknown, maxLen: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function parseOfferingType(v: unknown): OfferingType | undefined {
  if (v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'PRODUCT' || s === 'SERVICE' || s === 'OTHER') return s;
  return undefined;
}

export function parseBoolean(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  return undefined;
}

export function parseIntOptional(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return undefined;
}
