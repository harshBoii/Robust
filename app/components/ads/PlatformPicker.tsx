'use client';

import { type AdPlatform, type GoogleCampaignType, GOOGLE_CAMPAIGN_TYPES } from '@/lib/ads/platform';

type Props = {
  platform: AdPlatform | null;
  googleCampaignType: GoogleCampaignType | null;
  onPlatformChange: (p: AdPlatform) => void;
  onCampaignTypeChange: (t: GoogleCampaignType) => void;
};

const PLATFORMS: { value: AdPlatform; label: string; description: string; icon: string }[] = [
  {
    value: 'META',
    label: 'Meta',
    description: 'Facebook & Instagram ads. Campaign → Ad Set → Ad.',
    icon: 'M',
  },
  {
    value: 'GOOGLE',
    label: 'Google Ads',
    description: 'Search, Display, and Performance Max campaigns.',
    icon: 'G',
  },
];

export function PlatformPicker({
  platform,
  googleCampaignType,
  onPlatformChange,
  onCampaignTypeChange,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Choose Ad Platform</h3>
        <div className="grid grid-cols-2 gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPlatformChange(p.value)}
              className={[
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                platform === p.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-card/80',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                  platform === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {p.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {platform === 'GOOGLE' && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Campaign Type</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GOOGLE_CAMPAIGN_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => onCampaignTypeChange(t.value)}
                className={[
                  'flex flex-col rounded-xl border p-3 text-left transition-all',
                  googleCampaignType === t.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-primary/50',
                ].join(' ')}
              >
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
