import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";
import { buildBountyGenerationPayload } from "@/lib/geo/bounty/buildBountyPayload";
import {
  AEO_PAGE_MICROSERVICE_PATH,
  getContentType,
} from "@/lib/geo/bounty/spread-platforms";
import {
  getGeneratorPageObject,
  parseSocialGeneratorResponse,
  type SocialGeneratorResponse,
} from "@/lib/geo/bounty/parseSocialGeneratorResponse";

export async function huntBountyForCompany(opts: {
  companyId: string;
  bountyId: string;
}) {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
  });

  if (!bounty) {
    throw new Error("Bounty not found");
  }
  if (bounty.status !== "OPEN") {
    throw new Error("Only OPEN bounties can be hunted");
  }

  const payload = await buildBountyGenerationPayload({
    companyId: opts.companyId,
    query: bounty.query,
  });

  const profile = await prisma.aeoGenerationProfile.findFirst({
    where: { companyId: opts.companyId },
    orderBy: { createdAt: "asc" },
    select: { baseUrl: true, locale: true },
  });

  const company = await prisma.company.findUnique({
    where: { id: opts.companyId },
    select: { website: true },
  });

  const baseUrl = profile?.baseUrl ?? company?.website ?? "";
  const locale = profile?.locale ?? "en";

  const prompt = await prisma.prompt.findFirst({
    where: {
      query: bounty.query,
      llmTopic: { companyId: opts.companyId },
    },
    select: { id: true, topicId: true },
  });

  const contentType = getContentType("WEBSITE_BLOG");

  await prisma.citationBounty.update({
    where: { id: bounty.id },
    data: { status: "IN_PROGRESS" },
  });

  try {
    const base = process.env.MICROSERVICE_URL;
    if (!base) throw new Error("MICROSERVICE_URL is not configured");
    const generatorUrl = `${base.replace(/\/$/, "")}${AEO_PAGE_MICROSERVICE_PATH}`;
    const res = await fetch(generatorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        content_type: contentType,
      }),
    });

    if (!res.ok) {
      throw new Error(`Generator responded with ${res.status}`);
    }

    const result = (await res.json()) as SocialGeneratorResponse;
    const page = getGeneratorPageObject(result);
    if (!page) {
      throw new Error("Generator response missing page field");
    }

    const { title, body: description } = parseSocialGeneratorResponse(result, bounty.query);

    const slug: string =
      result.slug ??
      (typeof page.slug === "string" ? page.slug : "") ??
      "";

    const seoTitle =
      (typeof page.seoTitle === "string" ? page.seoTitle : null) ??
      (typeof page.seo_title === "string" ? page.seo_title : null) ??
      result.seo_title ??
      null;

    const seoDescription =
      (typeof page.seoDescription === "string" ? page.seoDescription : null) ??
      (typeof page.seo_description === "string" ? page.seo_description : null) ??
      null;

    const aeoPage = await prisma.aeoPage.create({
      data: {
        companyId: opts.companyId,
        slug: slug || `bounty-${bounty.id}`,
        locale,
        pageType: bounty.pageType,
        status: "DRAFT",
        title,
        description,
        llm_prompt_id: prompt?.id ?? null,
        llm_topic_id: prompt?.topicId ?? null,
        facts: (page.facts ?? []) as unknown as Prisma.InputJsonValue,
        faq: (page.faq ?? []) as unknown as Prisma.InputJsonValue,
        claims: (page.claims ?? []) as unknown as Prisma.InputJsonValue,
        summary: (page.summary ?? {}) as unknown as Prisma.InputJsonValue,
        knowledgeGraph: (page.jsonLd ?? page.json_ld ?? {}) as unknown as Prisma.InputJsonValue,
        seoTitle,
        seoDescription,
        canonicalUrl: baseUrl && slug ? `${baseUrl.replace(/\/$/, "")}/${slug}` : null,
      },
    });

    await prisma.citationBounty.update({
      where: { id: bounty.id },
      data: {
        status: "HUNTED",
        huntedAt: new Date(),
        aeoPageId: aeoPage.id,
        generationContext: {
          ...(payload as Record<string, unknown>),
          content_type: contentType,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await syncBountyRevenueForCompany(prisma, opts.companyId);

    return { aeoPageId: aeoPage.id };
  } catch (err) {
    await prisma.citationBounty.update({
      where: { id: bounty.id },
      data: { status: "OPEN" },
    });
    throw err;
  }
}
