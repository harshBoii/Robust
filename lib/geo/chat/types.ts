import type { BountySpreadPlatform } from '@/app/generated/prisma/client';

export type GeoPendingPublish = {
  bountyId: string;
  platforms?: BountySpreadPlatform[];
  contentId?: string;
  approveAll?: boolean;
  redditSubreddit?: string;
  redditFlairId?: string;
  confirmed: boolean;
};

export type GeoChatState = {
  memory?: string;
  lastBountyId?: string;
  pendingPublish?: GeoPendingPublish;
  lastToolSummary?: string;
};

export type GeoToolContext = {
  companyId: string;
  sessionId: string;
  geo: GeoChatState;
};

export type GeoToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};
