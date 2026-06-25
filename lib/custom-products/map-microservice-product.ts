import type { Prisma } from '@/app/generated/prisma/client';

import { parseCustomProductBody } from '@/lib/custom-products/parse-body';
import type { MicroserviceCustomProduct } from '@/lib/custom-products/microservice-types';

export function mapMicroserviceProductToCreateInput(
  companyId: string,
  product: MicroserviceCustomProduct,
): Prisma.CustomProductUncheckedCreateInput {
  const parsed = parseCustomProductBody(product as Record<string, unknown>);

  if (!parsed.name) {
    throw new Error('Microservice returned a product without a name');
  }

  return {
    companyId,
    name: parsed.name,
    description: parsed.description ?? null,
    category: parsed.category ?? null,
    productType: parsed.productType ?? 'SERVICE',
    status: 'DRAFT',
    tagline: parsed.tagline ?? null,
    keyBenefits: parsed.keyBenefits ?? [],
    targetAudience: parsed.targetAudience ?? null,
    keywords: parsed.keywords ?? [],
    toneNotes: parsed.toneNotes ?? null,
    mediaUrls: parsed.mediaUrls ?? [],
    faqs: parsed.faqs ?? [],
    certifications: parsed.certifications ?? null,
  };
}
