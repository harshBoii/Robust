export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 255);
  return s || 'company';
}

export function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0] ?? '';
  d = d.split('?')[0] ?? '';
  return d.slice(0, 255);
}

export function domainToWebsite(domain: string): string {
  const d = normalizeDomain(domain);
  return d ? `https://${d}` : '';
}
