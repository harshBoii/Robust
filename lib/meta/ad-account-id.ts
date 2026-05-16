export class MetaIntegrationIncompleteError extends Error {
  constructor(message = 'Configure ad account and page in workspace settings.') {
    super(message);
    this.name = 'MetaIntegrationIncompleteError';
  }
}

/** Normalize to Meta Marketing API form: `act_<digits>`. */
export function normalizeMetaAdAccountId(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed.startsWith('act_')) return trimmed;
  if (/^\d+$/.test(trimmed)) return `act_${trimmed}`;
  return trimmed;
}

export function requireMetaAdAccountId(adAccountId: string | null | undefined): string {
  const id = normalizeMetaAdAccountId(adAccountId);
  if (!id || !id.startsWith('act_')) {
    throw new MetaIntegrationIncompleteError();
  }
  return id;
}
