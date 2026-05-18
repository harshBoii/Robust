'use client';

import { useState } from 'react';

import { buildCreativeApplyPatch } from '@/lib/assistant/merge-preset-patch';

import { RobustaAvatar } from './RobustaAvatar';
import { SkippedFieldsBanner } from './SkippedFieldsBanner';

type CreativeResult = {
  headline: string;
  primaryText: string;
  description?: string;
  ctaType: string;
  landingUrl?: string;
  rationale: string;
  skippedFields: string[];
  partial: boolean;
};

export type CreativeModeRendererProps = {
  adType: string | null;
  tone: string | null;
  onAdTypeCapture?: (v: string) => void;
  onToneCapture?: (v: string) => void;
  assetId: string | null;
  groupLabel?: string;
  onApply: (patch: Record<string, string>) => void;
  disabled?: boolean;
};

export function CreativeModeRenderer({
  adType,
  tone,
  onAdTypeCapture,
  onToneCapture,
  assetId,
  groupLabel,
  onApply,
  disabled,
}: CreativeModeRendererProps) {
  const [localAdType, setLocalAdType] = useState('');
  const [localTone, setLocalTone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreativeResult | null>(null);

  const effectiveAdType = adType ?? localAdType;
  const effectiveTone = tone ?? localTone;

  const needsContext = !effectiveAdType.trim() || !effectiveTone.trim();

  async function analyze() {
    if (!assetId || needsContext) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant/creative-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          adType: effectiveAdType,
          tone: effectiveTone,
          groupLabel,
        }),
      });
      const data = (await res.json()) as CreativeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    const patch = buildCreativeApplyPatch(result, result.skippedFields);
    onApply(patch);
  }

  if (disabled) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        Creative analysis is available on the Creative Fields step when a video is ready.
      </p>
    );
  }

  if (!assetId) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        Select or upload a video in this group to analyze frames for copy ideas.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-1">
      {needsContext && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Tell me your ad type and tone (required for analysis).
          </p>
          {!adType && (
            <input
              className="glass-input w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Ad type e.g. OUTCOME_SALES"
              value={localAdType}
              onChange={(e) => {
                setLocalAdType(e.target.value);
                onAdTypeCapture?.(e.target.value);
              }}
            />
          )}
          {!tone && (
            <input
              className="glass-input w-full rounded-lg px-3 py-2 text-sm"
              placeholder="Tone e.g. UGC-style"
              value={localTone}
              onChange={(e) => {
                setLocalTone(e.target.value);
                onToneCapture?.(e.target.value);
              }}
            />
          )}
        </div>
      )}

      {!result && (
        <button
          type="button"
          disabled={loading || needsContext}
          onClick={() => void analyze()}
          className="glass-button-primary w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Analyzing video…' : 'Analyze video for copy ideas'}
        </button>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <RobustaAvatar />
            <p className="text-sm text-foreground leading-relaxed">{result.rationale}</p>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Headline:</span> {result.headline}
            </p>
            <p>
              <span className="font-medium text-foreground">Primary:</span> {result.primaryText}
            </p>
            {result.description ? (
              <p>
                <span className="font-medium text-foreground">Description:</span> {result.description}
              </p>
            ) : null}
            <p>
              <span className="font-medium text-foreground">CTA:</span> {result.ctaType}
            </p>
          </div>
          <SkippedFieldsBanner skippedFields={result.skippedFields} />
          <button
            type="button"
            onClick={handleApply}
            className="glass-button-primary w-full rounded-xl py-2 text-sm font-medium text-white"
          >
            Apply to creative fields
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="text-xs text-muted-foreground hover:underline"
          >
            Analyze again
          </button>
        </div>
      )}

      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
