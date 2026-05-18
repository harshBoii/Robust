'use client';

import { useState } from 'react';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { AD_TYPE_LABELS, CAMPAIGN_OBJECTIVE_OPTIONS } from '@/lib/assistant/constants';
import {
  mergeAdsetPresetPatch,
  mergeCampaignPresetPatch,
} from '@/lib/assistant/merge-preset-patch';
import type { AdsetPresetPatch, CampaignPresetPatch } from '@/lib/assistant/schemas';

import { RobustaAvatar } from './RobustaAvatar';
import { SkippedFieldsBanner } from './SkippedFieldsBanner';

const TONE_CHIPS = [
  'Aggressive scale',
  'Conservative test',
  'Premium brand',
  'UGC-style',
] as const;

type PresetResult = {
  campaign: Partial<CampaignPresetPatch> | null;
  adset: Partial<AdsetPresetPatch> | null;
  explanation: string;
  skippedFields: string[];
  partial: boolean;
};

export type PresetModeRendererProps = {
  adType: string | null;
  tone: string | null;
  onAdTypeChange: (v: string) => void;
  onToneChange: (v: string) => void;
  draftCampaign: CampaignPreset | null;
  draftAdset: AdsetPreset | null;
  onApplyCampaign: (next: CampaignPreset) => void;
  onApplyAdset: (next: AdsetPreset) => void;
  onAdvancedTargetingSync?: (json: string) => void;
  showDefaultWarning?: boolean;
  disabled?: boolean;
};

async function fetchPresetBuilder(body: Record<string, unknown>): Promise<PresetResult> {
  const res = await fetch('/api/assistant/preset-builder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PresetResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function PresetModeRenderer({
  adType,
  tone,
  onAdTypeChange,
  onToneChange,
  draftCampaign,
  draftAdset,
  onApplyCampaign,
  onApplyAdset,
  onAdvancedTargetingSync,
  showDefaultWarning,
  disabled,
}: PresetModeRendererProps) {
  const [step, setStep] = useState<'adType' | 'tone' | 'extra' | 'result'>('adType');
  const [extra, setExtra] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PresetResult | null>(null);

  async function generate() {
    if (!adType || !tone) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPresetBuilder({
        adType,
        tone,
        extraContext: extra.trim() || undefined,
        currentCampaignDraft: draftCampaign,
        currentAdsetDraft: draftAdset,
      });
      setResult(data);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function applyCampaign() {
    if (!result?.campaign || !draftCampaign) return;
    const next = mergeCampaignPresetPatch(draftCampaign, result.campaign);
    onApplyCampaign(next);
  }

  function applyAdset() {
    if (!result?.adset || !draftAdset) return;
    const next = mergeAdsetPresetPatch(draftAdset, result.adset);
    onApplyAdset(next);
    if (result.adset.targeting && onAdvancedTargetingSync) {
      onAdvancedTargetingSync(JSON.stringify(result.adset.targeting, null, 2));
    }
  }

  function applyBoth() {
    applyCampaign();
    applyAdset();
  }

  const campaignSkipped = result?.skippedFields.filter((f) => f.startsWith('campaign.')) ?? [];
  const adsetSkipped = result?.skippedFields.filter((f) => f.startsWith('adset.')) ?? [];

  if (disabled) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        Preset help is available on the Campaign and Ad Set steps.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-1">
      {showDefaultWarning ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          You are editing your default preset — review before saving.
        </div>
      ) : null}

      {step === 'adType' && (
        <>
          <p className="text-sm text-foreground">What type of ad are you running?</p>
          <div className="flex flex-wrap gap-1.5">
            {CAMPAIGN_OBJECTIVE_OPTIONS.map((obj) => (
              <button
                key={obj}
                type="button"
                onClick={() => {
                  onAdTypeChange(obj);
                  setStep('tone');
                }}
                className={[
                  'rounded-full px-2.5 py-1 text-xs font-medium transition',
                  adType === obj
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80',
                ].join(' ')}
              >
                {AD_TYPE_LABELS[obj]}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'tone' && (
        <>
          <p className="text-sm text-foreground">What tone should this campaign have?</p>
          <div className="flex flex-wrap gap-1.5">
            {TONE_CHIPS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onToneChange(t);
                  setStep('extra');
                }}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            className="glass-input w-full resize-none rounded-xl px-3 py-2 text-sm"
            rows={2}
            placeholder="Or describe your tone…"
            value={tone ?? ''}
            onChange={(e) => onToneChange(e.target.value)}
          />
          <button
            type="button"
            disabled={!tone?.trim()}
            onClick={() => setStep('extra')}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-40"
          >
            Continue
          </button>
        </>
      )}

      {step === 'extra' && (
        <>
          <p className="text-sm text-muted-foreground">Any budget, geo, or audience notes? (optional)</p>
          <textarea
            className="glass-input w-full resize-none rounded-xl px-3 py-2 text-sm"
            rows={2}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="e.g. ₹500/day, ages 25–45, India"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className="glass-button-primary w-full rounded-xl py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate preset suggestions'}
          </button>
          <button type="button" onClick={() => void generate()} className="text-xs text-muted-foreground hover:underline">
            Skip and generate
          </button>
        </>
      )}

      {step === 'result' && result && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <RobustaAvatar />
            <p className="text-sm text-foreground leading-relaxed">{result.explanation}</p>
          </div>
          <SkippedFieldsBanner skippedFields={campaignSkipped} prefix="Campaign" />
          <SkippedFieldsBanner skippedFields={adsetSkipped} prefix="Ad set" />
          <div className="flex flex-col gap-2">
            {result.campaign && draftCampaign ? (
              <button
                type="button"
                onClick={applyCampaign}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Apply to campaign preset
              </button>
            ) : null}
            {result.adset && draftAdset ? (
              <button
                type="button"
                onClick={applyAdset}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Apply to ad set preset
              </button>
            ) : null}
            {result.campaign && result.adset && draftCampaign && draftAdset ? (
              <button
                type="button"
                onClick={applyBoth}
                className="glass-button-primary rounded-xl px-3 py-2 text-sm font-medium text-white"
              >
                Apply both
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setStep('adType')}
              className="text-xs text-muted-foreground hover:underline"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
