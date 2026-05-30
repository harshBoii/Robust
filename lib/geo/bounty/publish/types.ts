import type { AeoPage, BountyContent, BountySpreadPlatform } from "@/app/generated/prisma/client";

export type PublishResult = {
  publishedUrl?: string | null;
  externalPostId?: string | null;
};

export type PublishAvailability = {
  available: boolean;
  reason?: string;
};

export interface PublishAdapter {
  platform: BountySpreadPlatform;
  isAvailable(companyId: string): Promise<PublishAvailability>;
  publish(opts: {
    companyId: string;
    bountyId: string;
    content: BountyContent;
    aeoPage?: AeoPage | null;
  }): Promise<PublishResult>;
}
