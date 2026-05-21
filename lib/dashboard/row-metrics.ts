/** Shared metric helpers for Meta dashboard rows (live refresh + DB snapshot). */

export type MetaActionRow = { action_type?: string; value?: string };

export function parseMetaActions(raw: unknown): MetaActionRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw as MetaActionRow[];
}

export function sumActionValue(
  actions: MetaActionRow[] | undefined,
  match: string,
): number {
  if (!actions?.length) return 0;
  return actions.reduce((acc, a) => {
    if (a.action_type === match) return acc + asNumber(a.value);
    return acc;
  }, 0);
}

export function asNumber(v: string | number | undefined | null): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function computeCpi(input: {
  spend: number;
  actions?: MetaActionRow[];
  clicks?: number;
}): number | null {
  const installs = sumActionValue(input.actions, 'mobile_app_install');
  if (installs > 0) return input.spend / installs;
  const clicks = input.clicks ?? 0;
  if (clicks > 0) return input.spend / clicks;
  return null;
}

/** Hook rate from Meta video 2s watch actions (live refresh). */
export function computeHookRateFromVideo(input: {
  impressions: number;
  video2s?: MetaActionRow[];
}): number | null {
  if (input.impressions <= 0) return null;
  const views2s = (input.video2s ?? []).reduce((acc, x) => acc + asNumber(x.value), 0);
  if (views2s <= 0) return null;
  return views2s / input.impressions;
}

export function daysBetweenUtc(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.max(0, Math.floor((end - start) / msPerDay));
}
