'use client';

import { PlatformPicker } from '@/app/components/ads/PlatformPicker';
import type { AdPlatform, GoogleCampaignType } from '@/lib/ads/platform';
import { useState } from 'react';

// ─── PlatformChoiceWidget ────────────────────────────────────────────────────

type PlatformChoiceProps = {
  onAction: (action: string, payload: Record<string, unknown>) => void;
};

export function PlatformChoiceWidget({ onAction }: PlatformChoiceProps) {
  const [platform, setPlatform] = useState<AdPlatform>('META');
  const [campaignType, setCampaignType] = useState<GoogleCampaignType>('DISPLAY');

  const handleConfirm = () => {
    onAction('platform.selected', { platform: platform.toLowerCase() });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 max-w-lg">
      <PlatformPicker
        platform={platform}
        googleCampaignType={campaignType}
        onPlatformChange={setPlatform}
        onCampaignTypeChange={setCampaignType}
      />
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Continue with {platform === 'GOOGLE' ? 'Google Ads' : 'Meta'}
      </button>
    </div>
  );
}

// ─── CampaignTypeWidget ──────────────────────────────────────────────────────

import { GOOGLE_CAMPAIGN_TYPES } from '@/lib/ads/platform';

type CampaignTypeProps = {
  onAction: (action: string, payload: Record<string, unknown>) => void;
};

export function GoogleCampaignTypeWidget({ onAction }: CampaignTypeProps) {
  const [selected, setSelected] = useState<GoogleCampaignType | null>(null);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 max-w-lg">
      <p className="text-sm font-semibold text-foreground">Select a Google campaign type:</p>
      <div className="space-y-2">
        {GOOGLE_CAMPAIGN_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSelected(t.value)}
            className={[
              'w-full flex flex-col rounded-xl border p-3 text-left transition-all',
              selected === t.value
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:border-primary/50',
            ].join(' ')}
          >
            <span className="text-sm font-semibold text-foreground">{t.label}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{t.description}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onAction('google.campaignTypeSelected', { campaignType: selected })}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

// ─── GoogleCreativeFormWidget ─────────────────────────────────────────────────

type GoogleCreativeFormProps = {
  campaignType?: string;
  onAction: (action: string, payload: Record<string, unknown>) => void;
};

export function GoogleCreativeFormWidget({ campaignType = 'DISPLAY', onAction }: GoogleCreativeFormProps) {
  const [headlines, setHeadlines] = useState(['', '', '']);
  const [descriptions, setDescriptions] = useState(['', '']);
  const [longHeadline, setLongHeadline] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [finalUrl, setFinalUrl] = useState('');

  const isSearch = campaignType === 'SEARCH';
  const maxHeadlines = isSearch ? 15 : 5;
  const maxDescriptions = isSearch ? 4 : 5;

  const valid = headlines.filter(Boolean).length >= 3 && finalUrl.trim();

  const handleSubmit = () => {
    if (!valid) return;
    onAction('google.creativeSubmitted', {
      headlines: headlines.filter(Boolean),
      descriptions: descriptions.filter(Boolean),
      longHeadline: longHeadline || undefined,
      businessName: businessName || undefined,
      finalUrl,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 max-w-lg">
      <p className="text-sm font-semibold">
        {isSearch ? 'Responsive Search Ad' : campaignType === 'PERFORMANCE_MAX' ? 'Performance Max Assets' : 'Responsive Display Ad'}
      </p>

      <div>
        <label className="block text-xs font-semibold mb-1">Final URL *</label>
        <input
          value={finalUrl}
          onChange={(e) => setFinalUrl(e.target.value)}
          placeholder="https://example.com/landing"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1">
          Headlines (min 3, max {maxHeadlines})
        </label>
        <div className="space-y-1.5">
          {headlines.map((h, i) => (
            <input
              key={i}
              value={h}
              onChange={(e) => {
                const updated = [...headlines];
                updated[i] = e.target.value;
                setHeadlines(updated);
              }}
              placeholder={`Headline ${i + 1}${i < 3 ? ' *' : ''}`}
              maxLength={30}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ))}
        </div>
        {headlines.length < maxHeadlines && (
          <button
            type="button"
            onClick={() => setHeadlines((p) => [...p, ''])}
            className="mt-1.5 text-xs text-primary hover:underline"
          >
            + Add headline
          </button>
        )}
      </div>

      {!isSearch && (
        <div>
          <label className="block text-xs font-semibold mb-1">Long Headline</label>
          <input
            value={longHeadline}
            onChange={(e) => setLongHeadline(e.target.value)}
            placeholder="Up to 90 characters"
            maxLength={90}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold mb-1">
          Descriptions (min 2, max {maxDescriptions})
        </label>
        <div className="space-y-1.5">
          {descriptions.map((d, i) => (
            <input
              key={i}
              value={d}
              onChange={(e) => {
                const updated = [...descriptions];
                updated[i] = e.target.value;
                setDescriptions(updated);
              }}
              placeholder={`Description ${i + 1}${i < 2 ? ' *' : ''}`}
              maxLength={90}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ))}
        </div>
        {descriptions.length < maxDescriptions && (
          <button
            type="button"
            onClick={() => setDescriptions((p) => [...p, ''])}
            className="mt-1.5 text-xs text-primary hover:underline"
          >
            + Add description
          </button>
        )}
      </div>

      {!isSearch && (
        <div>
          <label className="block text-xs font-semibold mb-1">Business Name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Your brand name"
            maxLength={25}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        Preview Ad
      </button>
    </div>
  );
}
