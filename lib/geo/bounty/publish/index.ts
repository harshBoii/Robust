import { prisma } from "@/lib/prisma";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { approveBountyToShopify } from "@/lib/geo/bounty/approveBountyToShopify";
import { approveBountyToWordPress } from "@/lib/geo/bounty/approveBountyToWordPress";
import {
  getBlogConnectivity,
  resolveBlogDestination,
  type BlogDestination,
} from "@/lib/geo/bounty/blog-destination";
import type {
  PublishAdapter,
  PublishResult,
  RedditPublishOptions,
} from "@/lib/geo/bounty/publish/types";
import { publishViaZernio } from "@/lib/zernio/publish";

async function getSocialIntegration(companyId: string, provider: "X" | "LINKEDIN" | "REDDIT") {
  return prisma.socialIntegration.findUnique({
    where: { companyId_provider: { companyId, provider } },
    select: { zernioAccountId: true, accountHandle: true },
  });
}

const websiteBlogAdapter: PublishAdapter = {
  platform: "WEBSITE_BLOG",
  async isAvailable(companyId) {
    const connectivity = await getBlogConnectivity(companyId);
    if (connectivity.shopify || connectivity.wordpress) return { available: true };
    return {
      available: false,
      reason:
        "Connect Shopify or WordPress under Profile → Integrations to publish website blogs",
    };
  },
  async publish(opts) {
    if (!opts.aeoPage) {
      throw new Error("No AEO page found for this bounty");
    }

    const resolution = await resolveBlogDestination({
      companyId: opts.companyId,
      requested: opts.destination ?? null,
    });
    if (!resolution.ok) {
      throw new Error(resolution.reason);
    }

    if (resolution.destination === "shopify") {
      const result = await approveBountyToShopify({
        companyId: opts.companyId,
        bountyId: opts.bountyId,
      });
      return {
        publishedUrl: result.canonicalUrl ?? null,
        externalPostId: result.articleId ?? null,
        destination: "shopify",
        warnings: result.partial
          ? ["Shopify reported errors but the article was created."]
          : undefined,
      };
    }

    const result = await approveBountyToWordPress({
      companyId: opts.companyId,
      bountyId: opts.bountyId,
    });
    return {
      publishedUrl: result.canonicalUrl ?? null,
      externalPostId: result.postId != null ? String(result.postId) : null,
      destination: "wordpress",
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    };
  },
};

const thirdPartyBlogAdapter: PublishAdapter = {
  platform: "THIRD_PARTY_BLOG",
  async isAvailable() {
    const base = process.env.MICROSERVICE_URL?.trim();
    if (base) return { available: true };
    return {
      available: false,
      reason: "Third-party blog publishing requires MICROSERVICE_URL",
    };
  },
  async publish(opts) {
    const base = process.env.MICROSERVICE_URL?.trim();
    if (!base) throw new Error("MICROSERVICE_URL is not configured");

    const res = await fetch(`${base.replace(/\/$/, "")}/aeo/social/publish/third-party-blog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: opts.companyId,
        bounty_id: opts.bountyId,
        title: opts.content.title,
        body: opts.content.body,
        metadata: opts.content.metadata,
      }),
    });

    if (!res.ok) {
      throw new Error(`Third-party blog publish failed (${res.status})`);
    }

    const data = (await res.json()) as { url?: string; post_id?: string };
    return {
      publishedUrl: data.url ?? null,
      externalPostId: data.post_id ?? null,
    };
  },
};

function createSocialAdapter(
  platform: "X" | "LINKEDIN" | "REDDIT",
  provider: "X" | "LINKEDIN" | "REDDIT"
): PublishAdapter {
  return {
    platform,
    async isAvailable(companyId) {
      const integration = await getSocialIntegration(companyId, provider);
      if (integration?.zernioAccountId?.trim()) return { available: true };
      return {
        available: false,
        reason: `Connect ${provider} under Profile → Integrations`,
      };
    },
    async publish(opts) {
      return publishViaZernio({
        companyId: opts.companyId,
        provider,
        contentBody: opts.content.body,
        title: opts.content.title,
        reddit: opts.reddit,
      });
    },
  };
}

const ADAPTERS: Record<BountySpreadPlatform, PublishAdapter> = {
  WEBSITE_BLOG: websiteBlogAdapter,
  THIRD_PARTY_BLOG: thirdPartyBlogAdapter,
  X: createSocialAdapter("X", "X"),
  REDDIT: createSocialAdapter("REDDIT", "REDDIT"),
  LINKEDIN: createSocialAdapter("LINKEDIN", "LINKEDIN"),
};

export function getPublishAdapter(platform: BountySpreadPlatform): PublishAdapter {
  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`No publish adapter for platform: ${platform}`);
  return adapter;
}

export async function publishBountyContent(opts: {
  companyId: string;
  bountyId: string;
  platform: BountySpreadPlatform;
  contentId?: string;
  reddit?: RedditPublishOptions;
  /** WEBSITE_BLOG only: publish to Shopify or WordPress. */
  destination?: BlogDestination | null;
}): Promise<PublishResult & { contentId: string }> {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: opts.bountyId, companyId: opts.companyId },
    include: {
      aeoPage: true,
      contents:
        opts.platform === "WEBSITE_BLOG"
          ? false
          : opts.contentId
            ? { where: { id: opts.contentId } }
            : { where: { platform: opts.platform } },
    },
  });

  if (!bounty) throw new Error("Bounty not found");

  if (opts.platform === "WEBSITE_BLOG") {
    const adapter = getPublishAdapter("WEBSITE_BLOG");
    const availability = await adapter.isAvailable(opts.companyId);
    if (!availability.available) {
      throw new Error(availability.reason ?? "Platform not available");
    }
    const result = await adapter.publish({
      companyId: opts.companyId,
      bountyId: opts.bountyId,
      content: {
        id: "",
        companyId: opts.companyId,
        bountyId: opts.bountyId,
        platform: "WEBSITE_BLOG",
        status: "DRAFT",
        title: bounty.aeoPage?.title ?? null,
        body: bounty.aeoPage?.description ?? "",
        metadata: null,
        publishedUrl: null,
        externalPostId: null,
        approvedAt: null,
        publishedAt: null,
        errorMessage: null,
        generationContext: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      aeoPage: bounty.aeoPage,
      destination: opts.destination ?? null,
    });
    return { ...result, contentId: bounty.aeoPage?.id ?? "" };
  }

  const content = Array.isArray(bounty.contents) ? bounty.contents[0] : undefined;
  if (!content) throw new Error("Content not found for platform");

  if (content.status === "PUBLISHED") {
    throw new Error("Content is already published");
  }

  const adapter = getPublishAdapter(opts.platform);
  const availability = await adapter.isAvailable(opts.companyId);
  if (!availability.available) {
    throw new Error(availability.reason ?? "Platform not available");
  }

  try {
    const result = await adapter.publish({
      companyId: opts.companyId,
      bountyId: opts.bountyId,
      content,
      aeoPage: bounty.aeoPage,
      reddit: opts.platform === 'REDDIT' ? opts.reddit : undefined,
    });

    await prisma.bountyContent.update({
      where: { id: content.id },
      data: {
        status: "PUBLISHED",
        approvedAt: content.approvedAt ?? new Date(),
        publishedAt: new Date(),
        publishedUrl: result.publishedUrl?.slice(0, 1000) ?? null,
        externalPostId: result.externalPostId?.slice(0, 255) ?? null,
        errorMessage: null,
      },
    });

    return { ...result, contentId: content.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    await prisma.bountyContent.update({
      where: { id: content.id },
      data: { status: "FAILED", errorMessage: message },
    });
    throw err;
  }
}
