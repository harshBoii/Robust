import type { AeoPage, BountyContent, BountySpreadPlatform } from "@/app/generated/prisma/client";
import type { BlogDestination } from "@/lib/geo/bounty/blog-destination";

export type PublishResult = {
  publishedUrl?: string | null;
  externalPostId?: string | null;
  /** Which provider handled a WEBSITE_BLOG publish. */
  destination?: BlogDestination;
  /** Non-fatal issues worth surfacing to the user (e.g. schema could not be verified). */
  warnings?: string[];
};

export type PublishAvailability = {
  available: boolean;
  reason?: string;
};

export type RedditPublishOptions = {
  subreddit: string;
  flairId?: string;
};

export interface PublishAdapter {
  platform: BountySpreadPlatform;
  isAvailable(companyId: string): Promise<PublishAvailability>;
  publish(opts: {
    companyId: string;
    bountyId: string;
    content: BountyContent;
    aeoPage?: AeoPage | null;
    reddit?: RedditPublishOptions;
    /** WEBSITE_BLOG only: which provider to publish to. */
    destination?: BlogDestination | null;
  }): Promise<PublishResult>;
}
