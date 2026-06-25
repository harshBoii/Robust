import type { CustomProduct } from '@/app/generated/prisma/client';

import type { CustomProductDto, CustomProductFaq } from './types';

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asFaqArray(v: unknown): CustomProductFaq[] {
  if (!Array.isArray(v)) return [];
  const items: CustomProductFaq[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const question = typeof row.question === 'string' ? row.question : '';
    const answer = typeof row.answer === 'string' ? row.answer : '';
    if (!question || !answer) continue;
    items.push({ question, answer });
  }
  return items;
}

export function serializeCustomProduct(product: CustomProduct): CustomProductDto {
  return {
    id: product.id,
    companyId: product.companyId,
    name: product.name,
    description: product.description,
    category: product.category,
    productType: product.productType,
    status: product.status,
    tagline: product.tagline,
    keyBenefits: asStringArray(product.keyBenefits),
    targetAudience: product.targetAudience,
    keywords: asStringArray(product.keywords),
    toneNotes: product.toneNotes,
    mediaUrls: asStringArray(product.mediaUrls),
    faqs: asFaqArray(product.faqs),
    certifications: product.certifications,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
