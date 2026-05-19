'use client';

import type { ReactNode } from 'react';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { AD_TYPE_LABELS } from '@/lib/assistant/constants';
import {
  getAdvantageAudienceFromTargeting,
  getTargetingExcludedAudiencesForEditor,
  getTargetingInterestsForEditor,
} from '@/lib/meta/targeting';

export type CreativePreview = {
  headline: string;
  primaryText: string;
  description?: string;
  ctaType: string;
  landingUrl?: string;
};

function display(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.trim() ? value : '—';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value);
    return s === '{}' ? '—' : s;
  }
  return String(value);
}

function Row({ label, value }: { label: string; value: unknown }) {
  const text = display(value);
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-mono text-[11px] text-foreground">{text}</span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-clipfox-primary">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function formatTargetingRows(targeting: Record<string, unknown> | null | undefined) {
  if (!targeting || typeof targeting !== 'object') {
    return [{ label: 'Targeting', value: '—' }];
  }
  const t = targeting;
  const geo =
    t.geo_locations && typeof t.geo_locations === 'object'
      ? (t.geo_locations as { countries?: string[] }).countries?.join(', ')
      : undefined;

  const interests = getTargetingInterestsForEditor(t);
  const excluded = getTargetingExcludedAudiencesForEditor(t);
  const advantage = getAdvantageAudienceFromTargeting(t);

  const rows: { label: string; value: unknown }[] = [
    { label: 'Age min', value: t.age_min },
    { label: 'Age max', value: t.age_max },
    { label: 'Genders', value: t.genders },
    { label: 'Countries', value: geo },
    { label: 'Locales', value: t.locales },
    { label: 'Device platforms', value: t.device_platforms },
    { label: 'Publisher platforms', value: t.publisher_platforms },
    { label: 'Facebook positions', value: t.facebook_positions },
    { label: 'Instagram positions', value: t.instagram_positions },
    { label: 'Audience network positions', value: t.audience_network_positions },
    { label: 'Messenger positions', value: t.messenger_positions },
    {
      label: 'Advantage audience',
      value: advantage === 1 ? 'Enabled (1)' : 'Disabled (0)',
    },
    {
      label: 'Interests',
      value: interests.length ? interests : undefined,
    },
    { label: 'Custom audiences', value: t.custom_audiences },
    {
      label: 'Excluded audiences',
      value: excluded.length ? excluded : undefined,
    },
  ];

  return rows;
}

export function PresetFieldPreviewCard({
  campaign,
  adset,
  previewTarget = 'both',
}: {
  campaign: CampaignPreset | null;
  adset: AdsetPreset | null;
  /** When set, show only the section being edited (ad set view still shows parent campaign summary). */
  previewTarget?: 'campaign' | 'adset' | 'both';
}) {
  const objective =
    campaign?.objective && campaign.objective in AD_TYPE_LABELS
      ? AD_TYPE_LABELS[campaign.objective as keyof typeof AD_TYPE_LABELS]
      : campaign?.objective;

  const targeting =
    adset?.targeting && typeof adset.targeting === 'object'
      ? (adset.targeting as Record<string, unknown>)
      : null;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Form preview
      </p>
      <p className="text-[10px] text-muted-foreground">
        Budgets shown in smallest currency unit (e.g. paise for INR).
      </p>

      {campaign && (previewTarget === 'campaign' || previewTarget === 'both' || previewTarget === 'adset') ? (
        <Section title={previewTarget === 'adset' ? 'Parent campaign (context)' : 'Campaign'}>
          {previewTarget === 'adset' ? (
            <>
              <Row label="Name" value={campaign.name} />
              <Row label="Objective" value={objective} />
              <Row label="Daily budget" value={campaign.dailyBudget} />
              <Row label="Lifetime budget" value={campaign.lifetimeBudget} />
              <Row label="Bid strategy" value={campaign.bidStrategy} />
            </>
          ) : (
            <>
              <Row label="Name" value={campaign.name} />
              <Row label="Objective" value={objective} />
              <Row label="Status" value={campaign.status} />
              <Row label="Spend cap" value={campaign.spendCap} />
              <Row label="Daily budget" value={campaign.dailyBudget} />
              <Row label="Lifetime budget" value={campaign.lifetimeBudget} />
              <Row label="Bid strategy" value={campaign.bidStrategy} />
              <Row label="Special ad categories" value={campaign.specialAdCategories} />
              <Row label="Ad set budget sharing" value={campaign.isAdsetBudgetSharingEnabled} />
              <Row label="Default preset" value={campaign.isDefault} />
            </>
          )}
        </Section>
      ) : null}

      {adset && (previewTarget === 'adset' || previewTarget === 'both') ? (
        <Section title="Ad set">
          <Row label="Name" value={adset.name} />
          <Row label="Pinned campaign" value={adset.pinnedCampaign?.name ?? adset.pinnedCampaignId} />
          <Row label="Daily budget" value={adset.dailyBudget} />
          <Row label="Lifetime budget" value={adset.lifetimeBudget} />
          <Row label="Schedule duration" value={adset.scheduleDuration} />
          <Row label="Schedule custom end" value={adset.scheduleCustomEnd} />
          <Row label="Billing event" value={adset.billingEvent} />
          <Row label="Optimization goal" value={adset.optimizationGoal} />
          <Row label="Destination type" value={adset.destinationType} />
          <Row label="Bid strategy" value={adset.bidStrategy} />
          <Row label="Bid amount" value={adset.bidAmount} />
          <Row label="Pacing type" value={adset.pacingType} />
          <Row label="Default preset" value={adset.isDefault} />
          <Row label="Dynamic creative" value={adset.isDefaultCreative} />
          <Row label="Promoted object" value={adset.promotedObject} />
          <Row label="Attribution spec" value={adset.attributionSpec} />
          <Row label="Bid constraints" value={adset.bidConstraints} />
          <div className="border-t border-border/40 pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Targeting
            </p>
            {formatTargetingRows(targeting).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </Section>
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
