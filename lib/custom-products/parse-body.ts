import type { CustomProductStatus, CustomProductType } from '@/app/generated/prisma/client';

import { parseStringArray, trimOptionalString } from '@/lib/data-mine/parse-body';

import type { CustomProductFaq } from './types';

export function parseCustomProductType(v: unknown): CustomProductType | undefined {
  if (v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'PRODUCT' || s === 'SERVICE') return s;
  return undefined;
}

export function parseCustomProductStatus(v: unknown): CustomProductStatus | undefined {
  if (v === undefined) return undefined;
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s === 'ACTIVE' || s === 'INACTIVE' || s === 'DRAFT') return s;
  return undefined;
}

export function parseFaqArray(v: unknown): CustomProductFaq[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;

  const items: CustomProductFaq[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const question = typeof row.question === 'string' ? row.question.trim() : '';
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    if (!question || !answer) continue;
    items.push({ question, answer });
  }
  return items;
}

export function parseCustomProductBody(body: Record<string, unknown>) {
  return {
    name: trimOptionalString(body.name, 500),
    description: trimOptionalString(body.description, 50000),
    category: trimOptionalString(body.category, 255),
    productType: parseCustomProductType(body.productType),
    status: parseCustomProductStatus(body.status),
    tagline: trimOptionalString(body.tagline, 500),
    keyBenefits: parseStringArray(body.keyBenefits),
    targetAudience: trimOptionalString(body.targetAudience, 50000),
    keywords: parseStringArray(body.keywords),
    toneNotes: trimOptionalString(body.toneNotes, 50000),
    mediaUrls: parseStringArray(body.mediaUrls),
    faqs: parseFaqArray(body.faqs),
    certifications: trimOptionalString(body.certifications, 50000),
  };
}
