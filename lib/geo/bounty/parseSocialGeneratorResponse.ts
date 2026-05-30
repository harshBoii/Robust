import type { Prisma } from "@/app/generated/prisma/client";

export type SocialGeneratorPage = {
  slug?: string | null;
  seoTitle?: string | null;
  seo_title?: string | null;
  headline?: string | null;
  title?: string | null;
  body?: string | null;
  text?: string | null;
  content?: string | null;
  summary?: unknown;
  seoDescription?: string | null;
  seo_description?: string | null;
  [key: string]: unknown;
};

export type SocialGeneratorResponse = {
  content_type?: string;
  status?: string | null;
  content?: SocialGeneratorPage | string | null;
  page?: SocialGeneratorPage | string | null;
  slug?: string | null;
  seo_title?: string | null;
  rejection_reason?: string | null;
  duplicate_status?: string | null;
  duplicate_reason?: string | null;
  prompt?: string | null;
  drafted_facts_count?: number;
  verified_facts_count?: number;
  faq_count?: number;
  claims_count?: number;
};

function extractPageBody(page: SocialGeneratorPage | string | null | undefined): string | null {
  if (typeof page === "string") {
    const trimmed = page.trim();
    return trimmed || null;
  }
  if (!page || typeof page !== "object") return null;

  const candidates = [page.body, page.text, page.content];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (typeof page.summary === "string" && page.summary.trim()) return page.summary.trim();
  if (typeof page.seoDescription === "string" && page.seoDescription.trim()) {
    return page.seoDescription.trim();
  }
  if (typeof page.seo_description === "string" && page.seo_description.trim()) {
    return page.seo_description.trim();
  }
  return null;
}

function extractPageTitle(
  page: SocialGeneratorPage | string | null | undefined,
  seoTitle: string | null | undefined,
  fallback: string
): string {
  if (seoTitle?.trim()) return seoTitle.trim();
  if (page && typeof page === "object") {
    const candidates = [page.seoTitle, page.seo_title, page.headline, page.title];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return fallback;
}

export function getGeneratorPageObject(
  result: SocialGeneratorResponse
): SocialGeneratorPage | null {
  const page = result.page ?? result.content ?? null;
  if (typeof page === "string") return { body: page };
  if (page && typeof page === "object") return page;
  return null;
}

export function parseSocialGeneratorResponse(
  result: SocialGeneratorResponse,
  fallbackQuery: string
): {
  title: string;
  body: string;
  metadata: Prisma.InputJsonValue;
} {
  const page = result.page ?? result.content ?? null;
  const body = extractPageBody(page);
  if (!body) {
    throw new Error("Generator response missing page body");
  }

  const title = extractPageTitle(page, result.seo_title, fallbackQuery);
  const slug =
    result.slug ??
    (page && typeof page === "object" && typeof page.slug === "string" ? page.slug : null);

  const metadata = {
    content_type: result.content_type ?? null,
    status: result.status ?? null,
    slug,
    seo_title: result.seo_title ?? null,
    rejection_reason: result.rejection_reason ?? null,
    duplicate_status: result.duplicate_status ?? null,
    duplicate_reason: result.duplicate_reason ?? null,
    prompt: result.prompt ?? null,
    drafted_facts_count: result.drafted_facts_count ?? null,
    verified_facts_count: result.verified_facts_count ?? null,
    faq_count: result.faq_count ?? null,
    claims_count: result.claims_count ?? null,
    page,
  } satisfies Record<string, unknown>;

  return {
    title,
    body,
    metadata: metadata as Prisma.InputJsonValue,
  };
}
