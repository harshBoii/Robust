import 'server-only';

import { createChatSession } from '@/lib/chats/repository';
import { runAutoAdsPipeline } from '@/lib/chats/auto-ads-pipeline';
import { appendChatMessages } from '@/lib/chats/repository';
import { serializeMessage } from '@/lib/chats/serialize';
import { getMetaAdsAutoConfig } from '@/lib/meta-ads-auto/config';
import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/defaults';
import { prisma } from '@/lib/prisma';

import type { JobRunResult, MetaAutoAdsJobSettings } from './types';
import { parseMetaAutoAdsSettings } from './validate-settings';

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function buildBrandSeeds(brand: {
  topics: string[];
  keywords: string[];
  targetAudiences: string[];
  offerings: Array<{ useCases: string[]; name: string | null }>;
}): string[] {
  const seeds: string[] = [];
  for (const t of brand.topics) if (t.trim()) seeds.push(t.trim());
  for (const k of brand.keywords) if (k.trim()) seeds.push(k.trim());
  for (const a of brand.targetAudiences) if (a.trim()) seeds.push(a.trim());
  for (const o of brand.offerings) {
    if (o.name?.trim()) seeds.push(o.name.trim());
    for (const u of o.useCases) if (u.trim()) seeds.push(u.trim());
  }
  return [...new Set(seeds)];
}

function buildAdPrompt(seed: string, brandName: string): string {
  return `Create a Meta ad promoting ${seed} for ${brandName}. Explore a fresh creative angle aligned with our brand.`;
}

export async function runMetaAutoAdsJob(
  companyId: string,
  rawSettings?: Partial<MetaAutoAdsJobSettings>,
): Promise<JobRunResult> {
  const settings = parseMetaAutoAdsSettings(rawSettings ?? {});

  const [metaIntegration, brandEntity, baseConfig] = await Promise.all([
    prisma.metaIntegration.findFirst({
      where: { companyId, adAccountId: { not: null } },
      select: { id: true },
    }),
    prisma.brandEntity.findUnique({
      where: { companyId },
      include: { offerings: true },
    }),
    getMetaAdsAutoConfig(companyId),
  ]);

  if (!metaIntegration) {
    return { status: 'SKIPPED', error: 'Meta integration is not connected' };
  }
  if (!brandEntity) {
    return { status: 'SKIPPED', error: 'Brand entity is required for auto ad generation' };
  }

  const seeds = buildBrandSeeds({
    topics: brandEntity.topics,
    keywords: brandEntity.keywords,
    targetAudiences: brandEntity.targetAudiences,
    offerings: brandEntity.offerings.map((o) => ({ useCases: o.useCases, name: o.name })),
  });

  if (seeds.length === 0) {
    return { status: 'SKIPPED', error: 'No brand topics or keywords to generate ad ideas from' };
  }

  const config: MetaAdsAutoConfigData = {
    ...baseConfig,
    autoPost: settings.publishMode === 'publish',
    autoModeDefault: true,
  };

  const sessionIds: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < settings.adsPerRun; i++) {
    const seed = pickRandom(seeds);
    if (!seed) break;

    const title = `Auto: ${seed.slice(0, 48)}`;
    const userText = buildAdPrompt(seed, brandEntity.canonicalName);

    try {
      const created = await createChatSession({
        companyId,
        createdByUserId: 'system',
        title,
        workflowState: { autoMode: true },
      });

      const [userMessageRow] = await appendChatMessages(created.id, [
        { role: 'USER', content: userText },
      ]);

      await runAutoAdsPipeline({
        sessionId: created.id,
        companyId,
        userText,
        state: { autoMode: true, intentNotes: userText },
        config,
        userMessageRow: serializeMessage(userMessageRow),
      });

      sessionIds.push(created.id);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (sessionIds.length === 0) {
    return {
      status: 'FAILED',
      error: errors.join('; ') || 'Failed to create auto ad sessions',
    };
  }

  return {
    status: errors.length > 0 ? 'SUCCESS' : 'SUCCESS',
    summary: {
      sessionIds,
      adsCreated: sessionIds.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}
