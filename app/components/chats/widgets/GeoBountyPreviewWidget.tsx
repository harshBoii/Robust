'use client';

import { useState } from 'react';
import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import { HuntContentExplorer } from '@/app/components/geo/bounty/hunt-content-explorer';

export type GeoBountyPreviewWidgetPayload = {
  bountyId: string;
  query: string;
  hasBlog: boolean;
  initialPlatform: BountySpreadPlatform;
};

export function GeoBountyPreviewWidget({
  payload,
}: {
  payload: GeoBountyPreviewWidgetPayload;
}) {
  const { bountyId, query, hasBlog, initialPlatform } = payload;
  const [activeTab, setActiveTab] = useState<BountySpreadPlatform>(initialPlatform);

  if (!bountyId) return null;

  return (
    <div className="mt-3">
      <HuntContentExplorer
        bountyId={bountyId}
        query={query}
        hasBlog={hasBlog}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}

export function parseGeoBountyPreviewPayload(
  raw: unknown,
): GeoBountyPreviewWidgetPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const bountyId = typeof p.bountyId === 'string' ? p.bountyId : '';
  if (!bountyId) return null;
  const query = typeof p.query === 'string' ? p.query : '';
  const hasBlog = p.hasBlog === true;
  const initialPlatform =
    typeof p.initialPlatform === 'string'
      ? (p.initialPlatform as BountySpreadPlatform)
      : hasBlog
        ? 'WEBSITE_BLOG'
        : 'LINKEDIN';
  return { bountyId, query, hasBlog, initialPlatform };
}
