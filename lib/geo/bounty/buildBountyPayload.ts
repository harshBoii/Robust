import { prisma } from "@/lib/prisma";
import {
  buildAeoPageDnaPayload,
  type AeoPageDnaPayload,
} from "@/lib/geo/bounty/aeoDnaPayload";

function moneyToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function buildPriceString(params: {
  priceMinAmount?: unknown;
  priceMaxAmount?: unknown;
  currencyCode?: string | null;
}) {
  const min = moneyToString(params.priceMinAmount);
  const max = moneyToString(params.priceMaxAmount);
  const currency = params.currencyCode?.trim() ?? "";

  if (!min && !max) return null;

  if (min && max) {
    if (min === max) {
      return `${currency ? `${currency} ` : ""}${min}`.trim();
    }
    return `${currency ? `${currency} ` : ""}${min} - ${max}`.trim();
  }

  const single = min || max;
  return `${currency ? `${currency} ` : ""}${single}`.trim();
}

export function buildProductDescriptionWithPrice(input: {
  description?: string | null;
  priceMinAmount?: unknown;
  priceMaxAmount?: unknown;
  currencyCode?: string | null;
}) {
  const desc = input.description?.trim() ?? "";
  const priceStr = buildPriceString(input);
  if (!priceStr) return desc;
  if (!desc) return `Price: ${priceStr}`;
  return `${desc} | Price: ${priceStr}`;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

function asFaqArray(v: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(v)) return [];
  const items: Array<{ question: string; answer: string }> = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const question = typeof row.question === "string" ? row.question.trim() : "";
    const answer = typeof row.answer === "string" ? row.answer.trim() : "";
    if (!question || !answer) continue;
    items.push({ question, answer });
  }
  return items;
}

export function buildCustomProductDescription(product: {
  description?: string | null;
  category?: string | null;
  productType?: string | null;
  tagline?: string | null;
  keyBenefits?: unknown;
  targetAudience?: string | null;
  keywords?: unknown;
  toneNotes?: string | null;
  mediaUrls?: unknown;
  faqs?: unknown;
  certifications?: string | null;
}) {
  const parts: string[] = [];

  const tagline = product.tagline?.trim();
  if (tagline) parts.push(`Tagline: ${tagline}`);

  const meta: string[] = [];
  if (product.category?.trim()) meta.push(`Category: ${product.category.trim()}`);
  if (product.productType?.trim()) {
    meta.push(`Type: ${product.productType.trim().toLowerCase()}`);
  }
  if (meta.length) parts.push(meta.join(" | "));

  const description = product.description?.trim();
  if (description) parts.push(description);

  const targetAudience = product.targetAudience?.trim();
  if (targetAudience) parts.push(`Target audience: ${targetAudience}`);

  const keyBenefits = asStringArray(product.keyBenefits);
  if (keyBenefits.length) {
    parts.push(`Key benefits:\n${keyBenefits.map((b) => `- ${b}`).join("\n")}`);
  }

  const keywords = asStringArray(product.keywords);
  if (keywords.length) parts.push(`Keywords: ${keywords.join(", ")}`);

  const toneNotes = product.toneNotes?.trim();
  if (toneNotes) parts.push(`Tone: ${toneNotes}`);

  const certifications = product.certifications?.trim();
  if (certifications) parts.push(`Certifications: ${certifications}`);

  const mediaUrls = asStringArray(product.mediaUrls);
  if (mediaUrls.length) parts.push(`Media: ${mediaUrls.join(", ")}`);

  const faqs = asFaqArray(product.faqs);
  if (faqs.length) {
    parts.push(
      `FAQs:\n${faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`,
    );
  }

  return parts.join("\n\n");
}

export type StandOutProductInput = {
  name: string;
  shortDescription: string;
};

export async function buildStandOutProducts(
  companyId: string,
): Promise<StandOutProductInput[]> {
  const [shopifyProducts, customProducts] = await Promise.all([
    prisma.shopifyProduct.findMany({
      where: { companyId },
      select: {
        title: true,
        description: true,
        priceMinAmount: true,
        priceMaxAmount: true,
        currencyCode: true,
      },
      orderBy: { shopifyUpdatedAt: "desc" },
    }),
    prisma.customProduct.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        name: true,
        description: true,
        category: true,
        productType: true,
        tagline: true,
        keyBenefits: true,
        targetAudience: true,
        keywords: true,
        toneNotes: true,
        mediaUrls: true,
        faqs: true,
        certifications: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const fromShopify = shopifyProducts
    .filter((p) => Boolean(p.title?.trim()))
    .map((p) => ({
      name: p.title!.trim(),
      shortDescription: buildProductDescriptionWithPrice({
        description: p.description,
        priceMinAmount: p.priceMinAmount,
        priceMaxAmount: p.priceMaxAmount,
        currencyCode: p.currencyCode,
      }),
    }));

  const fromCustom = customProducts
    .filter((p) => Boolean(p.name?.trim()))
    .map((p) => ({
      name: p.name.trim(),
      shortDescription: buildCustomProductDescription(p),
    }));

  return [...fromShopify, ...fromCustom].slice(0, 7);
}

function topicTitleToPathSegment(title: string): string | null {
  const slug = title
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return null;
  return `/${slug}`;
}

export type BountyGenerationPayload = {
  base_url: string;
  same_as_links: string[];
  same_as_links_: string;
  locale: string;
  cluster_id: string;
  published_at: null;
  entity: {
    name: string;
    oneLiner: string;
    website: string;
    offerings: Array<{ name: string; description: string }>;
    differentiators: string[];
    competitors: string[];
  };
  intelligence: {
    product_docs: string;
    market_research: string;
    customer_feedback: string;
  };
  query: string;
  topic: string | null;
  topic_pages: string[];
  topic_page_names: string[];
  existing_slugs: string[];
} & AeoPageDnaPayload;

export async function buildBountyGenerationPayload(opts: {
  companyId: string;
  query: string;
}): Promise<BountyGenerationPayload> {
  const company = await prisma.company.findUnique({
    where: { id: opts.companyId },
    include: {
      brandEntity: {
        include: {
          offerings: true,
          communicationDna: true,
          audienceDna: true,
          complianceDna: true,
        },
      },
      aeoGenerationProfiles: {
        orderBy: { createdAt: "asc" },
      },
      geoDataSources: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!company || !company.brandEntity) {
    throw new Error("Missing BrandEntity for company; configure GEO data first.");
  }

  const brand = company.brandEntity;
  const profile = company.aeoGenerationProfiles[0] ?? null;
  const geoSources = company.geoDataSources ?? [];

  const baseUrl = profile?.baseUrl ?? company.website ?? "";
  const locale = profile?.locale ?? "en";
  const clusterId = profile?.clusterId ?? "cluster-immortel-comparison";
  const existingSlugs = profile?.existingSlugs ?? [];

  const dummySameAsLinksUrl = "https://example.com/dummy";
  const sameAsLinks = [dummySameAsLinksUrl];

  const primaryOffering =
    brand.offerings.find((o) => o.isPrimary) ?? brand.offerings[0] ?? null;
  const fallbackDifferentiators = [
    "LangGraph-based stateful agents",
    "Human-in-the-loop review",
    "Schema.org native output",
  ];
  const fallbackCompetitors = ["Jasper AI", "Writer.com", "Copy.ai"];

  const differentiators = primaryOffering?.differentiators?.length
    ? primaryOffering.differentiators
    : fallbackDifferentiators;
  const competitors = primaryOffering?.competitors?.length
    ? primaryOffering.competitors
    : fallbackCompetitors;

  const shopifyProducts = await prisma.shopifyProduct.findMany({
    where: { companyId: opts.companyId },
    select: {
      title: true,
      description: true,
      priceMinAmount: true,
      priceMaxAmount: true,
      currencyCode: true,
    },
    orderBy: { shopifyUpdatedAt: "desc" },
  });

  const customProducts = await prisma.customProduct.findMany({
    where: { companyId: opts.companyId, status: "ACTIVE" },
    select: {
      name: true,
      description: true,
      category: true,
      productType: true,
      tagline: true,
      keyBenefits: true,
      targetAudience: true,
      keywords: true,
      toneNotes: true,
      mediaUrls: true,
      faqs: true,
      certifications: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const offerings = [
    ...shopifyProducts.map((p) => ({
      name: p.title ?? "",
      description: buildProductDescriptionWithPrice({
        description: p.description,
        priceMinAmount: p.priceMinAmount,
        priceMaxAmount: p.priceMaxAmount,
        currencyCode: p.currencyCode,
      }),
    })),
    ...customProducts.map((p) => ({
      name: p.name,
      description: buildCustomProductDescription(p),
    })),
  ];

  const lowerIncludes = (label: string, needles: string[]) =>
    needles.some((n) => label.toLowerCase().includes(n));

  let productDocs = "";
  let marketResearch = "";
  let customerFeedback = "";

  for (const source of geoSources) {
    const label = source.label ?? "";
    const content = source.rawContent ?? "";
    if (!content) continue;

    if (
      lowerIncludes(label, ["research", "market", "competitor", "analysis"]) ||
      source.sourceType === "URL"
    ) {
      marketResearch += (marketResearch ? "\n\n" : "") + content;
    } else if (lowerIncludes(label, ["feedback", "testimonial", "review"])) {
      customerFeedback += (customerFeedback ? "\n\n" : "") + content;
    } else {
      productDocs += (productDocs ? "\n\n" : "") + content;
    }
  }

  const prompt = await prisma.prompt.findFirst({
    where: {
      query: opts.query,
      llmTopic: { companyId: opts.companyId },
    },
    select: {
      id: true,
      topicId: true,
      topic: true,
      llmTopic: { select: { name: true } },
    },
  });

  const topicName = (prompt?.llmTopic?.name ?? prompt?.topic ?? "").trim() || null;

  const topicPages = prompt?.topicId
    ? await prisma.aeoPage.findMany({
        where: {
          companyId: opts.companyId,
          llm_topic_id: prompt.topicId,
        },
        orderBy: { createdAt: "asc" },
        take: 25,
        select: { summary: true, title: true },
      })
    : [];

  const topicPagesSummaries = topicPages
    .map((p) => {
      const s = p.summary as unknown;
      if (typeof s === "string") return s.trim();
      if (s == null) return "";
      try {
        return JSON.stringify(s);
      } catch {
        return "";
      }
    })
    .map((s) => s.trim())
    .filter(Boolean);

  const topicPageNames = topicPages
    .map((p) => topicTitleToPathSegment(p.title ?? ""))
    .filter((x): x is string => Boolean(x));

  const dnaPayload = buildAeoPageDnaPayload(brand);

  return {
    base_url: baseUrl,
    same_as_links: sameAsLinks,
    same_as_links_: dummySameAsLinksUrl,
    locale,
    cluster_id: clusterId,
    published_at: null,
    entity: {
      name: brand.canonicalName ?? company.name,
      oneLiner: brand.oneLiner ?? company.description ?? "",
      website: company.website ?? "",
      offerings,
      differentiators,
      competitors,
    },
    intelligence: {
      product_docs: productDocs,
      market_research: marketResearch,
      customer_feedback: customerFeedback,
    },
    query: opts.query,
    topic: topicName,
    topic_pages: topicPagesSummaries,
    topic_page_names: topicPageNames,
    existing_slugs: existingSlugs,
    ...dnaPayload,
  };
}
