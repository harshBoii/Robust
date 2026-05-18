'use client';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { AD_TYPE_LABELS } from '@/lib/assistant/constants';

export type CreativePreview = {
  headline: string;
  primaryText: string;
  description?: string;
  ctaType: string;
  landingUrl?: string;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

export function PresetFieldPreviewCard({
  campaign,
  adset,
}: {
  campaign: CampaignPreset | null;
  adset: AdsetPreset | null;
}) {
  const geo =
    adset?.targeting &&
    typeof adset.targeting === 'object' &&
    'geo_locations' in adset.targeting
      ? (adset.targeting as { geo_locations?: { countries?: string[] } }).geo_locations
          ?.countries?.join(', ')
      : null;

  const objective =
    campaign?.objective &&
    campaign.objective in AD_TYPE_LABELS
      ? AD_TYPE_LABELS[campaign.objective as keyof typeof AD_TYPE_LABELS]
      : campaign?.objective;

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Form preview
      </p>
      {campaign ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-clipfox-primary">Campaign</p>
          <Row label="Objective" value={objective ?? null} />
          <Row label="Status" value={campaign.status} />
          <Row label="Daily budget" value={campaign.dailyBudget} />
          <Row label="Bid strategy" value={campaign.bidStrategy} />
        </div>
      ) : null}
      {adset ? (
        <div className="space-y-1 border-t border-border/40 pt-2">
          <p className="text-[11px] font-medium text-clipfox-primary">Ad set</p>
          <Row label="Daily budget" value={adset.dailyBudget} />
          <Row label="Optimization" value={adset.optimizationGoal} />
          <Row label="Billing" value={adset.billingEvent} />
          <Row label="Schedule" value={adset.scheduleDuration} />
          <Row label="Geo" value={geo} />
        </div>
      ) : null}
    </div>
  );
}

export function CreativeFieldPreviewCard({ creative }: { creative: CreativePreview }) {
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Creative preview
      </p>
      <Row label="Headline" value={creative.headline} />
      <Row label="Primary" value={creative.primaryText} />
      <Row label="Description" value={creative.description} />
      <Row label="CTA" value={creative.ctaType} />
      <Row label="Landing" value={creative.landingUrl} />
    </div>
  );
}
