import 'server-only';

import type { Prisma } from '@/app/generated/prisma/client';

import { prisma } from '@/lib/prisma';

import { intelWebhookPayloadSchema, type IntelWebhookPayload } from './types';

export class IntelWebhookError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = 'IntelWebhookError';
  }
}

function pickAssetId(raw: Record<string, unknown>): string | null {
  if (typeof raw.assetId === 'string' && raw.assetId.trim()) return raw.assetId.trim();
  if (typeof raw.asset_Id === 'string' && raw.asset_Id.trim()) return raw.asset_Id.trim();
  return null;
}

function pickCompanyId(raw: Record<string, unknown>): string | null {
  if (typeof raw.companyId === 'string' && raw.companyId.trim()) return raw.companyId.trim();
  if (typeof raw.company_id === 'string' && raw.company_id.trim()) return raw.company_id.trim();
  return null;
}

export function parseIntelPayload(body: unknown): IntelWebhookPayload {
  const wrapped =
    typeof body === 'object' && body !== null && 'payload' in body
      ? (body as { payload: unknown }).payload
      : body;

  if (typeof wrapped !== 'object' || wrapped === null) {
    throw new IntelWebhookError('Invalid webhook body');
  }

  const raw = wrapped as Record<string, unknown>;
  const assetId = pickAssetId(raw);
  const companyId = pickCompanyId(raw);
  if (!assetId || !companyId) {
    throw new IntelWebhookError('assetId and companyId are required');
  }

  const parsed = intelWebhookPayloadSchema.safeParse({
    ...raw,
    assetId,
    companyId,
  });

  if (!parsed.success) {
    throw new IntelWebhookError(parsed.error.message);
  }

  return parsed.data;
}

function jsonField(
  value: unknown,
  fallback: Prisma.InputJsonValue,
): Prisma.InputJsonValue {
  if (value === undefined || value === null) return fallback;
  return value as Prisma.InputJsonValue;
}

export async function upsertAssetIntelligence(payload: IntelWebhookPayload): Promise<void> {
  const asset = await prisma.asset.findFirst({
    where: { id: payload.assetId, companyId: payload.companyId },
    select: { id: true, companyId: true },
  });

  if (!asset) {
    throw new IntelWebhookError('Asset not found for company', 404);
  }

  const processedAt =
    payload.processedAt instanceof Date
      ? payload.processedAt
      : payload.processedAt
        ? new Date(payload.processedAt)
        : new Date();

  const data = {
    language: payload.language ?? null,
    contentType: payload.contentType ?? null,
    durationSeconds: payload.durationSeconds ?? null,
    theme: payload.theme ?? null,
    sentiment: payload.sentiment ?? null,
    intensityScore: payload.intensityScore ?? null,
    spiritualElements: payload.spiritualElements ?? false,
    titlePrimary: payload.titlePrimary ?? null,
    shortSummary: payload.shortSummary ?? null,
    longDescription: payload.longDescription ?? null,
    tags: payload.tags ?? [],
    tone: payload.tone ?? [],
    topics: payload.topics ?? [],
    targetAudience: payload.targetAudience ?? [],
    bestPlatforms: payload.bestPlatforms ?? [],
    visualContext: payload.visualContext ?? [],
    videoGenres: payload.videoGenres ?? [],
    titleVariants: jsonField(payload.titleVariants, {} as Prisma.InputJsonValue),
    chapters: jsonField(payload.chapters, [] as Prisma.InputJsonValue),
    shortsHooks: jsonField(payload.shortsHooks, [] as Prisma.InputJsonValue),
    missRobustaInsights: jsonField(
      payload.missRobustaInsights,
      [] as Prisma.InputJsonValue,
    ),
    modelVersion: payload.modelVersion ?? null,
    confidence: payload.confidence ?? null,
    processedAt,
    companyId: payload.companyId,
  };

  await prisma.$transaction([
    prisma.assetIntelligence.upsert({
      where: { assetId: payload.assetId },
      create: {
        assetId: payload.assetId,
        ...data,
      },
      update: data,
    }),
    prisma.asset.update({
      where: { id: payload.assetId },
      data: { intelligenceStatus: 'READY' },
    }),
  ]);
}
