import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import type { RunGetCitedResult } from '@/lib/geo/bounty/runGetCitedForCompany';

export type GeoBountyPreviewWidgetPayload = {
  bountyId: string;
  query: string;
  hasBlog: boolean;
  initialPlatform: BountySpreadPlatform;
};

const PLATFORM_TAB_ORDER: BountySpreadPlatform[] = [
  'WEBSITE_BLOG',
  'LINKEDIN',
  'X',
  'REDDIT',
  'THIRD_PARTY_BLOG',
];

export function buildGeoBountyPreviewFromToolResults(
  toolResults: Array<{
    name: string;
    args?: Record<string, unknown>;
    result: { ok: boolean; data?: unknown };
  }>,
): GeoBountyPreviewWidgetPayload | null {
  for (const tr of toolResults) {
    if (tr.name !== 'geo.get_cited' || !tr.result.ok) continue;
    const data = tr.result.data as RunGetCitedResult | undefined;
    if (!data?.bountyId) continue;

    const query =
      typeof tr.args?.query === 'string' && tr.args.query.trim()
        ? tr.args.query.trim()
        : '';
    const results = data.results ?? [];
    const hasBlog = results.some((r) => r.platform === 'WEBSITE_BLOG' && r.success);
    const initialPlatform =
      PLATFORM_TAB_ORDER.find((p) => results.some((r) => r.platform === p && r.success)) ??
      (hasBlog ? 'WEBSITE_BLOG' : 'LINKEDIN');

    return {
      bountyId: data.bountyId,
      query,
      hasBlog,
      initialPlatform,
    };
  }
  return null;
}
