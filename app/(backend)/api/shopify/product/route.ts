import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { indexProduct } from "@/lib/elasticsearch/products";
import { prisma } from "@/lib/prisma";
import {
  fetchShopifyProducts,
  parseShopifyAmount,
  parseShopifyDate,
  type ShopifyProductNode,
} from "@/lib/shopify/products";

export const dynamic = "force-dynamic";

function nodeToUpsertData(
  node: ShopifyProductNode,
  shopId: string,
  companyId: string,
) {
  const min = node.priceRangeV2?.minVariantPrice;
  const max = node.priceRangeV2?.maxVariantPrice;
  const priceMin = parseShopifyAmount(min?.amount);
  const priceMax = parseShopifyAmount(max?.amount);

  return {
    shopifyGid: node.id,
    shopId,
    companyId,
    title: node.title ?? "",
    status: node.status ?? null,
    totalInventory: node.totalInventory ?? null,
    onlineStoreUrl: node.onlineStoreUrl ?? null,
    description: node.description ?? null,
    featuredImageUrl: node.featuredImage?.url ?? null,
    featuredImageAltText: node.featuredImage?.altText ?? null,
    featuredImageWidth: node.featuredImage?.width ?? null,
    featuredImageHeight: node.featuredImage?.height ?? null,
    priceMinAmount: priceMin != null ? new Prisma.Decimal(priceMin) : null,
    priceMaxAmount: priceMax != null ? new Prisma.Decimal(priceMax) : null,
    currencyCode: min?.currencyCode ?? max?.currencyCode ?? null,
    shopifyCreatedAt: parseShopifyDate(node.createdAt),
    shopifyUpdatedAt: parseShopifyDate(node.updatedAt),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shopifyShop.findFirst({
    where: { companyId: session.companyId, status: "installed" },
  });

  if (!shop) {
    return NextResponse.json(
      { error: "No installed Shopify shop for this workspace" },
      { status: 404 },
    );
  }

  const { data, errors, raw } = await fetchShopifyProducts(shop);

  if (errors?.length) {
    return NextResponse.json(
      { success: false, error: errors.map((e) => e.message).join("; "), data: raw },
      { status: 502 },
    );
  }

  const edges = data?.products?.edges ?? [];
  const upserted: string[] = [];

  for (const edge of edges) {
    const node = edge?.node;
    if (!node?.id) continue;

    const payload = nodeToUpsertData(node, shop.id, shop.companyId);

    const product = await prisma.shopifyProduct.upsert({
      where: { shopifyGid: node.id },
      create: payload,
      update: {
        title: payload.title,
        status: payload.status,
        totalInventory: payload.totalInventory,
        onlineStoreUrl: payload.onlineStoreUrl,
        description: payload.description,
        featuredImageUrl: payload.featuredImageUrl,
        featuredImageAltText: payload.featuredImageAltText,
        featuredImageWidth: payload.featuredImageWidth,
        featuredImageHeight: payload.featuredImageHeight,
        priceMinAmount: payload.priceMinAmount,
        priceMaxAmount: payload.priceMaxAmount,
        currencyCode: payload.currencyCode,
        shopifyCreatedAt: payload.shopifyCreatedAt,
        shopifyUpdatedAt: payload.shopifyUpdatedAt,
      },
    });

    upserted.push(product.id);
    await indexProduct(product);
  }

  return NextResponse.json({
    success: true,
    synced: upserted.length,
    data: raw,
  });
}
