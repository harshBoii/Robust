/** Meta scales minimum ROAS by 10,000 (e.g. 10000 = 1.0×, 15000 = 1.5×). */
export const ROAS_AVERAGE_FLOOR_SCALE = 10_000;

export const DEFAULT_ROAS_AVERAGE_FLOOR = 10_000;

export const MIN_ROAS_AVERAGE_FLOOR = 100;
export const MAX_ROAS_AVERAGE_FLOOR = 10_000_000;

export function isValueMinRoasBid(
  bidStrategy: string | null | undefined,
  optimizationGoal: string | null | undefined,
): boolean {
  return optimizationGoal === 'VALUE' && bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS';
}

export function getRoasAverageFloor(bidConstraints: unknown): number | null {
  if (!bidConstraints || typeof bidConstraints !== 'object') return null;
  const raw = (bidConstraints as Record<string, unknown>).roas_average_floor;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.floor(n) : null;
  }
  return null;
}

export function roasMultipleToFloor(multiple: number): number {
  return Math.round(multiple * ROAS_AVERAGE_FLOOR_SCALE);
}

export function floorToRoasMultiple(floor: number): number {
  return floor / ROAS_AVERAGE_FLOOR_SCALE;
}

export function withRoasAverageFloor(
  bidConstraints: unknown,
  floor: number,
): Record<string, unknown> {
  const base =
    bidConstraints && typeof bidConstraints === 'object'
      ? { ...(bidConstraints as Record<string, unknown>) }
      : {};
  base.roas_average_floor = Math.floor(floor);
  return base;
}

/** Option A: VALUE + LOWEST_COST_WITH_MIN_ROAS + roas_average_floor (no bid_amount). */
export function applyValueMinRoasOptionA<T extends {
  bidStrategy?: string | null;
  optimizationGoal?: string | null;
  bidAmount?: string | null;
  bidConstraints?: Record<string, unknown> | null;
}>(draft: T): T {
  const floor = getRoasAverageFloor(draft.bidConstraints) ?? DEFAULT_ROAS_AVERAGE_FLOOR;
  return {
    ...draft,
    bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS',
    optimizationGoal: 'VALUE',
    bidAmount: null,
    bidConstraints: withRoasAverageFloor(draft.bidConstraints, floor),
  };
}

export function validateRoasAverageFloor(floor: number | null): { ok: true } | { ok: false; error: string } {
  if (floor == null) {
    return {
      ok: false,
      error: 'bid_constraints.roas_average_floor is required for VALUE + LOWEST_COST_WITH_MIN_ROAS',
    };
  }
  if (floor < MIN_ROAS_AVERAGE_FLOOR || floor > MAX_ROAS_AVERAGE_FLOOR) {
    return {
      ok: false,
      error: `roas_average_floor must be between ${MIN_ROAS_AVERAGE_FLOOR} and ${MAX_ROAS_AVERAGE_FLOOR} (${floorToRoasMultiple(MIN_ROAS_AVERAGE_FLOOR)}×–${floorToRoasMultiple(MAX_ROAS_AVERAGE_FLOOR)}× ROAS)`,
    };
  }
  return { ok: true };
}
