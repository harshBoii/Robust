import 'server-only';

import {
  DEFAULT_IMAGE_ARTIST_ID,
  IMAGE_ARTISTS,
  type ImageArtistId,
} from '@/lib/image-gen/image-artists';
import { prisma } from '@/lib/prisma';

import {
  DEFAULT_META_ADS_AUTO_CONFIG,
  type MetaAdsAutoConfigData,
  type MetaAdsMediaMode,
} from './defaults';

export type { MetaAdsAutoConfigData, MetaAdsMediaMode } from './defaults';
export { DEFAULT_META_ADS_AUTO_CONFIG } from './defaults';

function isValidArtistId(id: string | null | undefined): id is ImageArtistId {
  return Boolean(id && IMAGE_ARTISTS.some((a) => a.id === id));
}

function isValidMediaMode(mode: string): mode is MetaAdsMediaMode {
  return mode === 'auto_generate' || mode === 'manual_selection';
}

export function serializeMetaAdsAutoConfig(row: {
  autoModeDefault: boolean;
  allowNewCampaign: boolean;
  allowNewAdset: boolean;
  allowStaticGeneration: boolean;
  mediaMode: string;
  defaultArtistId: string | null;
  autoPost: boolean;
  defaultDailyBudget: number | null;
  defaultObjective: string | null;
}): MetaAdsAutoConfigData {
  return {
    autoModeDefault: row.autoModeDefault,
    allowNewCampaign: row.allowNewCampaign,
    allowNewAdset: row.allowNewAdset,
    allowStaticGeneration: row.allowStaticGeneration,
    mediaMode: isValidMediaMode(row.mediaMode) ? row.mediaMode : 'auto_generate',
    defaultArtistId: isValidArtistId(row.defaultArtistId)
      ? row.defaultArtistId
      : DEFAULT_IMAGE_ARTIST_ID,
    autoPost: row.autoPost,
    defaultDailyBudget: row.defaultDailyBudget,
    defaultObjective: row.defaultObjective,
  };
}

export async function getMetaAdsAutoConfig(companyId: string): Promise<MetaAdsAutoConfigData> {
  try {
    const row = await prisma.metaAdsAutoConfig.findUnique({
      where: { companyId },
    });
    if (!row) return { ...DEFAULT_META_ADS_AUTO_CONFIG };
    return serializeMetaAdsAutoConfig(row);
  } catch (e) {
    console.warn('[meta-ads-auto] config read failed — using defaults', e);
    return { ...DEFAULT_META_ADS_AUTO_CONFIG };
  }
}

export type MetaAdsAutoConfigPatch = Partial<MetaAdsAutoConfigData>;

export function validateMetaAdsAutoConfigPatch(
  patch: MetaAdsAutoConfigPatch,
): { ok: true; data: MetaAdsAutoConfigPatch } | { ok: false; error: string } {
  const data: MetaAdsAutoConfigPatch = {};

  if (patch.autoModeDefault !== undefined) {
    if (typeof patch.autoModeDefault !== 'boolean') {
      return { ok: false, error: 'autoModeDefault must be a boolean' };
    }
    data.autoModeDefault = patch.autoModeDefault;
  }
  if (patch.allowNewCampaign !== undefined) {
    if (typeof patch.allowNewCampaign !== 'boolean') {
      return { ok: false, error: 'allowNewCampaign must be a boolean' };
    }
    data.allowNewCampaign = patch.allowNewCampaign;
  }
  if (patch.allowNewAdset !== undefined) {
    if (typeof patch.allowNewAdset !== 'boolean') {
      return { ok: false, error: 'allowNewAdset must be a boolean' };
    }
    data.allowNewAdset = patch.allowNewAdset;
  }
  if (patch.allowStaticGeneration !== undefined) {
    if (typeof patch.allowStaticGeneration !== 'boolean') {
      return { ok: false, error: 'allowStaticGeneration must be a boolean' };
    }
    data.allowStaticGeneration = patch.allowStaticGeneration;
  }
  if (patch.mediaMode !== undefined) {
    if (!isValidMediaMode(patch.mediaMode)) {
      return { ok: false, error: 'mediaMode must be auto_generate or manual_selection' };
    }
    data.mediaMode = patch.mediaMode;
  }
  if (patch.defaultArtistId !== undefined) {
    if (!isValidArtistId(patch.defaultArtistId)) {
      return { ok: false, error: 'Invalid defaultArtistId' };
    }
    data.defaultArtistId = patch.defaultArtistId;
  }
  if (patch.autoPost !== undefined) {
    if (typeof patch.autoPost !== 'boolean') {
      return { ok: false, error: 'autoPost must be a boolean' };
    }
    data.autoPost = patch.autoPost;
  }
  if (patch.defaultDailyBudget !== undefined) {
    if (patch.defaultDailyBudget !== null && (!Number.isFinite(patch.defaultDailyBudget) || patch.defaultDailyBudget < 0)) {
      return { ok: false, error: 'defaultDailyBudget must be a non-negative number or null' };
    }
    data.defaultDailyBudget = patch.defaultDailyBudget;
  }
  if (patch.defaultObjective !== undefined) {
    if (patch.defaultObjective !== null && typeof patch.defaultObjective !== 'string') {
      return { ok: false, error: 'defaultObjective must be a string or null' };
    }
    data.defaultObjective = patch.defaultObjective?.trim() || null;
  }

  return { ok: true, data };
}

export async function upsertMetaAdsAutoConfig(
  companyId: string,
  patch: MetaAdsAutoConfigPatch,
): Promise<MetaAdsAutoConfigData> {
  const validated = validateMetaAdsAutoConfigPatch(patch);
  if (!validated.ok) throw new Error(validated.error);

  try {
    const row = await prisma.metaAdsAutoConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        ...DEFAULT_META_ADS_AUTO_CONFIG,
        ...validated.data,
      },
      update: validated.data,
    });

    return serializeMetaAdsAutoConfig(row);
  } catch (e) {
    console.error('[meta-ads-auto] config upsert failed', e);
    throw new Error(
      'Could not save Ads Automation settings. Run the database migration for meta_ads_auto_configs.',
    );
  }
}
