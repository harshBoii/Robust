import type { InsightTopicInput } from '@/lib/geo/geoknight/types';

function escapeRegExpLiteral(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanCompanyNameForRankMatch(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';

  let s = raw;
  try {
    const url = raw.includes('://') ? new URL(raw) : null;
    if (url?.hostname) s = url.hostname;
  } catch {
    // ignore
  }

  s = s.trim().toLowerCase();
  if (s.startsWith('www.')) s = s.slice(4);

  const looksLikeDomain = !/\s/.test(s) && s.includes('.');
  if (looksLikeDomain) {
    s = s.replace(/\.+$/, '');
    const parts = s.split('.');
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1]!;
      const commonTlds = new Set(['com', 'io', 'ai', 'net', 'org', 'co', 'app', 'dev', 'xyz']);
      if (commonTlds.has(tld)) {
        parts.pop();
        s = parts.join('.');
      }
    }
  }

  return s.trim();
}

function focusRowMatchesCompany(focusDisplayName: string, rowCompanyName: string): boolean {
  const normalizedFocus = cleanCompanyNameForRankMatch(focusDisplayName);
  if (!normalizedFocus) return false;
  let re: RegExp;
  try {
    re = new RegExp(escapeRegExpLiteral(normalizedFocus), 'i');
  } catch {
    return false;
  }
  const candidate = cleanCompanyNameForRankMatch(rowCompanyName);
  return candidate.length > 0 && re.test(candidate);
}

export function focusRankingForPrompt(
  prompt: InsightTopicInput['prompts'][number],
  focusDisplayName: string,
): number | null {
  if (!cleanCompanyNameForRankMatch(focusDisplayName)) return null;

  const matchingCons = (prompt.consensus ?? []).filter((c) =>
    focusRowMatchesCompany(focusDisplayName, c.companyName),
  );
  const consRanks = matchingCons
    .map((c) => c.avgRank)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  if (consRanks.length > 0) {
    return Math.min(...consRanks);
  }

  const matchingRows = (prompt.byModel ?? []).filter((b) =>
    focusRowMatchesCompany(focusDisplayName, b.companyName),
  );
  const ranks = matchingRows
    .map((b) => b.rank)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  if (ranks.length === 0) return null;
  return Math.min(...ranks);
}

export function buildRivalAnalyzeMicroPayload(
  topics: InsightTopicInput[],
  focusDisplayName: string,
  maxPrompts = 5,
): Record<string, { prompts: Array<{ text: string; ranking: number | null }> }> {
  const queues = topics
    .map((t) => ({
      name: (t.name ?? '').trim() || 'Untitled topic',
      prompts: [...(t.prompts ?? [])].filter((p) => String(p.query ?? '').trim().length > 0),
    }))
    .filter((t) => t.prompts.length > 0);

  const out: Record<string, { prompts: Array<{ text: string; ranking: number | null }> }> = {};
  const n = queues.length;
  if (n === 0 || maxPrompts <= 0) return out;

  let total = 0;

  while (total < maxPrompts) {
    let tookThisRound = false;
    for (let i = 0; i < n && total < maxPrompts; i++) {
      const q = queues[i]!;
      if (q.prompts.length === 0) continue;
      const p = q.prompts.shift()!;
      const text = String(p.query ?? '').trim();
      const ranking = focusRankingForPrompt(p, focusDisplayName);
      if (!out[q.name]) out[q.name] = { prompts: [] };
      out[q.name]!.prompts.push({ text, ranking });
      total++;
      tookThisRound = true;
    }
    if (!tookThisRound) break;
  }

  return out;
}
