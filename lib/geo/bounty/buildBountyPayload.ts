import { prisma } from "@/lib/prisma";

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

function buildProductDescriptionWithPrice(input: {
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
};

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

  const offerings = shopifyProducts.map((p) => ({
    name: p.title ?? "",
    description: buildProductDescriptionWithPrice({
      description: p.description,
      priceMinAmount: p.priceMinAmount,
      priceMaxAmount: p.priceMaxAmount,
      currencyCode: p.currencyCode,
    }),
  }));

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
  };
}
