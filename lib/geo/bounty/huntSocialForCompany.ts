import { prisma } from "@/lib/prisma";
import type { BountySpreadPlatform, Prisma } from "@/app/generated/prisma/client";
import { logMicroserviceResponse } from "@/lib/microservice/log-response";
import { buildBountyGenerationPayload } from "@/lib/geo/bounty/buildBountyPayload";
import {
  AEO_PAGE_MICROSERVICE_PATH,
  getContentType,
} from "@/lib/geo/bounty/spread-platforms";
import {
  parseSocialGeneratorResponse,
  type SocialGeneratorResponse,
} from "@/lib/geo/bounty/parseSocialGeneratorResponse";

async function markBountyHuntedIfNeeded(bountyId: string) {
  const bounty = await prisma.citationBounty.findUnique({
    where: { id: bountyId },
    select: { status: true, huntedAt: true },
  });
  if (!bounty) return;
  if (bounty.status === "HUNTED" && bounty.huntedAt) return;

  await prisma.citationBounty.update({
    where: { id: bountyId },
    data: {
      status: "HUNTED",
      huntedAt: bounty.huntedAt ?? new Date(),
    },
  });
}

export async function huntSocialForCompany(opts: {
  companyId: string;
  bountyId: string;
  platform: BountySpreadPlatform;
}) {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
  });

  if (!bounty) {
    throw new Error("Bounty not found");
  }

  if (bounty.status === "DISMISSED" || bounty.status === "EXPIRED") {
    throw new Error("Bounty is not eligible for content generation");
  }

  const payload = await buildBountyGenerationPayload({
    companyId: opts.companyId,
    query: bounty.query,
  });

  const base = process.env.MICROSERVICE_URL;
  if (!base) throw new Error("MICROSERVICE_URL is not configured");

  const contentType = getContentType(opts.platform);
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
    const text = await res.text().catch(() => "");
    console.error("[microservice:bounty-social] error", {
      status: res.status,
      platform: opts.platform,
      body: text,
    });
    throw new Error(`Social generator responded with ${res.status}`);
  }

  const result = (await res.json()) as SocialGeneratorResponse;
  logMicroserviceResponse(`bounty-social:${opts.platform}`, result);
  const { title, body, metadata } = parseSocialGeneratorResponse(result, bounty.query);

  const record = await prisma.bountyContent.upsert({
    where: {
      bountyId_platform: {
        bountyId: bounty.id,
        platform: opts.platform,
      },
    },
    create: {
      companyId: opts.companyId,
      bountyId: bounty.id,
      platform: opts.platform,
      status: "DRAFT",
      title,
      body,
      metadata,
      generationContext: {
        ...(payload as Record<string, unknown>),
        content_type: contentType,
      } as unknown as Prisma.InputJsonValue,
    },
    update: {
      status: "DRAFT",
      title,
      body,
      metadata,
      generationContext: {
        ...(payload as Record<string, unknown>),
        content_type: contentType,
      } as unknown as Prisma.InputJsonValue,
      errorMessage: null,
      approvedAt: null,
      publishedAt: null,
      publishedUrl: null,
      externalPostId: null,
    },
    select: { id: true, platform: true },
  });

  await markBountyHuntedIfNeeded(bounty.id);

  return { contentId: record.id, platform: record.platform };
}
