import type { Asset, CreativeFields, GroupModel } from '@/app/components/createAd/types';
import { isValidMetaLandingUrl } from '@/lib/assistant/landing-url-validation';
import { defaultCreativeFields } from '@/lib/create-ad/group-model';

export type CreativeCsvTarget =
  | 'media'
  | 'headline'
  | 'primaryText'
  | 'description'
  | 'landingUrl'
  | 'ctaType'
  | 'pixelId';

export type CreativeCsvColumnMapping = Partial<Record<CreativeCsvTarget, string>>;

export type CreativeCsvTargetDef = {
  id: CreativeCsvTarget;
  label: string;
  required: boolean;
  aliases: string[];
};

export const CREATIVE_CSV_TARGETS: CreativeCsvTargetDef[] = [
  {
    id: 'media',
    label: 'Media',
    required: false,
    aliases: [
      'media',
      'filename',
      'file',
      'file_name',
      'asset',
      'asset_id',
      'assetid',
      'image',
      'video',
      'creative',
    ],
  },
  {
    id: 'headline',
    label: 'Headline',
    required: true,
    aliases: ['headline', 'title', 'name', 'ad_headline'],
  },
  {
    id: 'primaryText',
    label: 'Primary text',
    required: false,
    aliases: ['primarytext', 'primary_text', 'primary text', 'body', 'message', 'copy'],
  },
  {
    id: 'description',
    label: 'Description',
    required: false,
    aliases: ['description', 'desc', 'subtitle'],
  },
  {
    id: 'landingUrl',
    label: 'Landing URL',
    required: true,
    aliases: ['landingurl', 'landing_url', 'landing url', 'url', 'link', 'destination_url'],
  },
  {
    id: 'ctaType',
    label: 'CTA type',
    required: false,
    aliases: ['ctatype', 'cta_type', 'cta', 'call_to_action'],
  },
  {
    id: 'pixelId',
    label: 'Pixel ID',
    required: false,
    aliases: ['pixelid', 'pixel_id', 'pixel'],
  },
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function guessColumnMapping(headers: string[]): CreativeCsvColumnMapping {
  const mapping: CreativeCsvColumnMapping = {};
  const used = new Set<string>();

  for (const target of CREATIVE_CSV_TARGETS) {
    const normalizedAliases = target.aliases.map(normalizeHeader);
    const match = headers.find((h) => {
      if (used.has(h)) return false;
      const n = normalizeHeader(h);
      return normalizedAliases.includes(n);
    });
    if (match) {
      mapping[target.id] = match;
      used.add(match);
    }
  }

  return mapping;
}

export function flattenSessionAssets(groups?: GroupModel[]): Asset[] {
  const seen = new Set<string>();
  const out: Asset[] = [];
  for (const g of groups ?? []) {
    for (const a of g.assets) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

function basename(value: string): string {
  const v = value.trim();
  const slash = Math.max(v.lastIndexOf('/'), v.lastIndexOf('\\'));
  return slash >= 0 ? v.slice(slash + 1) : v;
}

export function matchMediaValue(value: string, assets: Asset[]): Asset | null {
  const raw = value.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const base = basename(raw).toLowerCase();

  const byId = assets.find((a) => a.id === raw);
  if (byId) return byId;

  const byTitle = assets.find((a) => a.title.trim().toLowerCase() === lower);
  if (byTitle) return byTitle;

  const byFilename = assets.find(
    (a) => a.filename && a.filename.trim().toLowerCase() === lower,
  );
  if (byFilename) return byFilename;

  const byBaseTitle = assets.find((a) => basename(a.title).toLowerCase() === base);
  if (byBaseTitle) return byBaseTitle;

  const byBaseFilename = assets.find(
    (a) => a.filename && basename(a.filename).toLowerCase() === base,
  );
  if (byBaseFilename) return byBaseFilename;

  return null;
}

export type CsvCreativeRowResult = {
  rowIndex: number;
  asset: Asset | null;
  /** Raw media value from CSV when a media column is mapped. */
  mediaHint?: string;
  creative: CreativeFields;
  errors: string[];
};

export function applyManualMediaToRows(
  rows: CsvCreativeRowResult[],
  manualByRow: Record<number, string>,
  assets: Asset[],
): CsvCreativeRowResult[] {
  return rows.map((r) => {
    const manualId = manualByRow[r.rowIndex];
    const manualAsset = manualId ? assets.find((a) => a.id === manualId) ?? null : null;
    const asset = manualAsset ?? r.asset;
    const errors = r.errors.filter(
      (e) =>
        e !== 'Select media' &&
        !e.startsWith('No session asset matches'),
    );
    if (!asset) errors.push('Select media');
    return { ...r, asset, errors };
  });
}

function cellValue(row: string[], headers: string[], column?: string): string {
  if (!column) return '';
  const idx = headers.indexOf(column);
  if (idx < 0) return '';
  return (row[idx] ?? '').trim();
}

export function buildCsvCreativeRowResults(input: {
  headers: string[];
  rows: string[][];
  mapping: CreativeCsvColumnMapping;
  assets: Asset[];
  defaultPixelId?: string | null;
}): CsvCreativeRowResult[] {
  const { headers, rows, mapping, assets, defaultPixelId } = input;
  const results: CsvCreativeRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];
    const mediaVal = cellValue(row, headers, mapping.media);
    const headline = cellValue(row, headers, mapping.headline);
    const primaryText = cellValue(row, headers, mapping.primaryText);
    const description = cellValue(row, headers, mapping.description);
    const landingUrl = cellValue(row, headers, mapping.landingUrl);
    const ctaType = cellValue(row, headers, mapping.ctaType) || 'LEARN_MORE';
    const pixelId =
      cellValue(row, headers, mapping.pixelId) || defaultPixelId?.trim() || '';

    if (mapping.media && !mediaVal) errors.push('Missing media value in CSV');
    if (!mapping.headline) errors.push('Headline column not mapped');
    else if (!headline) errors.push('Missing headline');
    if (!mapping.landingUrl) errors.push('Landing URL column not mapped');
    else if (!landingUrl) errors.push('Missing landing URL');
    else if (!isValidMetaLandingUrl(landingUrl)) {
      errors.push('Landing URL must be a real https URL (not "CTA" or other placeholders)');
    }

    const asset = mediaVal ? matchMediaValue(mediaVal, assets) : null;
    const mediaHint = mediaVal || undefined;

    results.push({
      rowIndex: i,
      asset,
      mediaHint,
      creative: {
        ...defaultCreativeFields(),
        headline,
        primaryText: primaryText || headline,
        description,
        landingUrl,
        ctaType,
        pixelId,
      },
      errors,
    });
  }

  return results;
}

export function detectDuplicateAssetMatches(results: CsvCreativeRowResult[]): Map<number, string> {
  const byAsset = new Map<string, number[]>();
  const dupErrors = new Map<number, string>();

  for (const r of results) {
    if (!r.asset) continue;
    const list = byAsset.get(r.asset.id) ?? [];
    list.push(r.rowIndex);
    byAsset.set(r.asset.id, list);
  }

  for (const [, indices] of byAsset) {
    if (indices.length <= 1) continue;
    const msg = 'Duplicate media — each row must use a different asset';
    for (const idx of indices) dupErrors.set(idx, msg);
  }

  return dupErrors;
}

export function buildGroupsFromCsvRows(input: {
  rowResults: CsvCreativeRowResult[];
  defaultAdSetId?: string;
}): GroupModel[] {
  const { rowResults, defaultAdSetId = '' } = input;
  const groups: GroupModel[] = [];

  for (const r of rowResults) {
    if (!r.asset || r.errors.length > 0) continue;
    groups.push({
      bucketId: `csv-${r.asset.id}`,
      label: r.asset.title || `Ad ${groups.length + 1}`,
      assetIds: [r.asset.id],
      assets: [r.asset],
      included: true,
      adSetId: defaultAdSetId,
      creative: { ...r.creative },
    });
  }

  return groups;
}

export function validateCsvCreativeRows(groups: GroupModel[]): string | null {
  const included = groups.filter((g) => g.included);
  if (included.length === 0) return 'No valid ad rows to apply';

  for (const g of included) {
    if (!g.assetIds[0]) return `Missing media for "${g.label}"`;
    if (!g.creative.headline.trim()) return `Missing headline for "${g.label}"`;
    if (!g.creative.landingUrl.trim()) return `Missing landing URL for "${g.label}"`;
  }

  return null;
}

export function isMappingComplete(mapping: CreativeCsvColumnMapping): boolean {
  return Boolean(mapping.headline && mapping.landingUrl);
}
