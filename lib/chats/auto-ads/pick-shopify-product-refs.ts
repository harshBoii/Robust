import 'server-only';

import { prisma } from '@/lib/prisma';

export type ShopifyProductRef = {
  productId: string;
  title: string;
  description: string | null;
  imageUrl: string;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Pick random Shopify catalog images to use as product references (same source as image-gen shopify path). */
export async function pickRandomShopifyProductRefs(
  companyId: string,
  count: number,
): Promise<ShopifyProductRef[]> {
  if (count <= 0) return [];

  const products = await prisma.shopifyProduct.findMany({
    where: {
      companyId,
      featuredImageUrl: { not: null },
    },
    select: {
      id: true,
      title: true,
      description: true,
      featuredImageUrl: true,
    },
  });

  const withImages = products.filter((p) => p.featuredImageUrl?.trim());
  if (!withImages.length) return [];

  const shuffled = shuffle(withImages);

  return Array.from({ length: count }, (_, i) => {
    const product = shuffled[i % shuffled.length]!;
    return {
      productId: product.id,
      title: product.title,
      description: product.description?.slice(0, 2000) ?? null,
      imageUrl: product.featuredImageUrl!.trim(),
    };
  });
}
