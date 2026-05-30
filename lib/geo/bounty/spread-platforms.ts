import type { BountySpreadPlatform } from "@/app/generated/prisma/client";

/** Single microservice endpoint for all content generation (blogs + social). */
export const AEO_PAGE_MICROSERVICE_PATH = "/aeo/page";

export type SpreadPlatformOption = {
  value: BountySpreadPlatform;
  label: string;
  routeSlug: string | null;
  /** Microservice content_type sent in POST body, e.g. X_POST */
  contentType: string;
};

export const SPREAD_PLATFORM_OPTIONS: SpreadPlatformOption[] = [
  {
    value: "WEBSITE_BLOG",
    label: "Website (Blogs)",
    routeSlug: null,
    contentType: "BLOG_POST",
  },
  {
    value: "THIRD_PARTY_BLOG",
    label: "third party blogs",
    routeSlug: "third-party-blog",
    contentType: "THIRD_PARTY_BLOG_POST",
  },
  {
    value: "REDDIT",
    label: "reddit",
    routeSlug: "reddit",
    contentType: "REDDIT_POST",
  },
  {
    value: "X",
    label: "X",
    routeSlug: "x",
    contentType: "X_POST",
  },
  {
    value: "LINKEDIN",
    label: "Linkedin",
    routeSlug: "linkedin",
    contentType: "LINKEDIN_POST",
  },
];

export const ALL_SPREAD_PLATFORMS = SPREAD_PLATFORM_OPTIONS.map((o) => o.value);

export const DEFAULT_SPREAD_PLATFORMS: BountySpreadPlatform[] = ["WEBSITE_BLOG"];

export function getSpreadPlatformOption(
  platform: BountySpreadPlatform
): SpreadPlatformOption | undefined {
  return SPREAD_PLATFORM_OPTIONS.find((o) => o.value === platform);
}

export function getMicroservicePath(_platform?: BountySpreadPlatform): string {
  return AEO_PAGE_MICROSERVICE_PATH;
}

export function getContentType(platform: BountySpreadPlatform): string {
  const opt = getSpreadPlatformOption(platform);
  if (!opt?.contentType) {
    throw new Error(`No content_type mapping for platform: ${platform}`);
  }
  return opt.contentType;
}

export function getHuntedRouteSlug(platform: BountySpreadPlatform): string | null {
  const opt = getSpreadPlatformOption(platform);
  return opt?.routeSlug ?? null;
}

export function parseSpreadPlatforms(input: unknown): BountySpreadPlatform[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set(ALL_SPREAD_PLATFORMS);
  return input.filter(
    (p): p is BountySpreadPlatform =>
      typeof p === "string" && valid.has(p as BountySpreadPlatform)
  );
}

export function platformLabel(platform: BountySpreadPlatform): string {
  return getSpreadPlatformOption(platform)?.label ?? platform;
}

/** Label for Approve & Publish platform dropdown */
export function publishPlatformLabel(platform: BountySpreadPlatform): string {
  if (platform === "WEBSITE_BLOG") return "Blogs";
  if (platform === "LINKEDIN") return "LinkedIn";
  if (platform === "REDDIT") return "Reddit";
  if (platform === "X") return "X";
  if (platform === "THIRD_PARTY_BLOG") return "Third party blogs";
  return platformLabel(platform);
}
