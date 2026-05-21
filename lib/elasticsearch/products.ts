import type { ShopifyProduct } from "@/app/generated/prisma/client";
import { getElasticsearchClient, getProductsIndex } from "@/lib/elasticsearch/client";
import { prisma } from "@/lib/prisma";

export type ProductSearchHit = {
  id: string;
  shopifyGid: string;
  title: string;
  status: string | null;
  description: string | null;
  onlineStoreUrl: string | null;
  score?: number;
};

function productToDocument(product: ShopifyProduct) {
  return {
    id: product.id,
    companyId: product.companyId,
    shopId: product.shopId,
    shopifyGid: product.shopifyGid,
    title: product.title,
    status: product.status,
    handle: product.handle,
    description: product.description,
    onlineStoreUrl: product.onlineStoreUrl,
    totalInventory: product.totalInventory,
    priceMinAmount: product.priceMinAmount?.toString() ?? null,
    priceMaxAmount: product.priceMaxAmount?.toString() ?? null,
    currencyCode: product.currencyCode,
    featuredImageUrl: product.featuredImageUrl,
    shopifyUpdatedAt: product.shopifyUpdatedAt?.toISOString() ?? null,
  };
}

export async function indexProduct(product: ShopifyProduct): Promise<void> {
  const client = getElasticsearchClient();
  if (!client) return;

  const index = getProductsIndex();
  try {
    await client.index({
      index,
      id: product.id,
      document: productToDocument(product),
      refresh: false,
    });
  } catch (err) {
    console.error("[elasticsearch] indexProduct failed", product.id, err);
  }
}

export async function searchProducts(
  companyId: string,
  query: string,
  limit = 20,
): Promise<ProductSearchHit[]> {
  const client = getElasticsearchClient();
  if (!client) return [];

  const index = getProductsIndex();
  const q = query.trim();

  try {
    const result = await client.search({
      index,
      size: limit,
      query: q
        ? {
            bool: {
              must: [{ term: { companyId } }],
              should: [
                {
                  multi_match: {
                    query: q,
                    fields: ["title^3", "description", "handle"],
                    type: "best_fields",
                    fuzziness: "AUTO",
                  },
                },
              ],
              minimum_should_match: 1,
            },
          }
        : {
            bool: {
              must: [{ term: { companyId } }],
            },
          },
    });

    return result.hits.hits.map((hit) => {
      const src = hit._source as Record<string, unknown>;
      return {
        id: String(src.id ?? hit._id),
        shopifyGid: String(src.shopifyGid ?? ""),
        title: String(src.title ?? ""),
        status: (src.status as string | null) ?? null,
        description: (src.description as string | null) ?? null,
        onlineStoreUrl: (src.onlineStoreUrl as string | null) ?? null,
        score: typeof hit._score === "number" ? hit._score : undefined,
      };
    });
  } catch (err) {
    console.error("[elasticsearch] searchProducts failed", err);
    return [];
  }
}

export async function bulkReindexFromDb(companyId: string): Promise<{
  indexed: number;
  failed: number;
}> {
  const client = getElasticsearchClient();
  if (!client) {
    return { indexed: 0, failed: 0 };
  }

  const products = await prisma.shopifyProduct.findMany({
    where: { companyId },
  });

  const index = getProductsIndex();
  let indexed = 0;
  let failed = 0;

  const operations = products.flatMap((product) => [
    { index: { _index: index, _id: product.id } },
    productToDocument(product),
  ]);

  if (operations.length === 0) {
    return { indexed: 0, failed: 0 };
  }

  try {
    const bulk = await client.bulk({ operations, refresh: false });
    if (bulk.errors) {
      for (const item of bulk.items ?? []) {
        const op = item.index ?? item.create ?? item.update;
        if (op?.error) failed += 1;
        else indexed += 1;
      }
    } else {
      indexed = products.length;
    }
  } catch (err) {
    console.error("[elasticsearch] bulkReindexFromDb failed", err);
    failed = products.length;
  }

  return { indexed, failed };
}
