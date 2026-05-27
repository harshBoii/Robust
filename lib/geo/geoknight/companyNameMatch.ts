export type RivalRowsPrompt = {
  consensus: { companyName: string }[];
  byModel: { companyName: string }[];
};

export function cleanCompanyNameForMatch(input: string): string {
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

export function cleanCompanyNameForLabel(input: string): string {
  const c = cleanCompanyNameForMatch(input);
  if (!c) return '';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function uniqueCompanyNamesForPrompt(prompt: RivalRowsPrompt): string[] {
  const names = new Set<string>();
  for (const c of prompt.consensus ?? []) {
    const n = c.companyName?.trim();
    if (n) names.add(n);
  }
  for (const c of prompt.byModel ?? []) {
    const n = c.companyName?.trim();
    if (n) names.add(n);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function compileCompanyNameRegex(pattern: string): RegExp | null {
  const p = pattern.trim();
  if (!p) return null;
  try {
    return new RegExp(p, 'i');
  } catch {
    return null;
  }
}

export function escapeRegExpLiteral(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSelfFocusRegex(companyDisplayName: string | null | undefined): RegExp | null {
  const name = cleanCompanyNameForMatch(companyDisplayName?.trim() ?? '');
  return name ? compileCompanyNameRegex(escapeRegExpLiteral(name)) : null;
}

export function promptMatchesCompanyFocus(prompt: RivalRowsPrompt, focusRegex: RegExp | null): boolean {
  if (!focusRegex) return false;
  const names = uniqueCompanyNamesForPrompt(prompt).map(cleanCompanyNameForMatch).filter(Boolean);
  return names.some((n) => focusRegex.test(n));
}
