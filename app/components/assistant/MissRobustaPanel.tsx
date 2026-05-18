'use client';

import Image from 'next/image';
import { useState } from 'react';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';

import {
  CreativeModeRenderer,
  type CreativeFields,
} from './CreativeModeRenderer';
import { PresetModeRenderer } from './PresetModeRenderer';

export type MissRobustaMode = 'preset' | 'creative';

export type MissRobustaPanelProps = {
  mode: MissRobustaMode;
  activePresetTab?: 'campaign' | 'adset';
  subtitle?: string;
  presetDisabled?: boolean;
  creativeDisabled?: boolean;
  adType: string | null;
  tone: string | null;
  onAdTypeChange: (v: string) => void;
  onToneChange: (v: string) => void;
  draftCampaign: CampaignPreset | null;
  draftAdset: AdsetPreset | null;
  onApplyCampaign: (next: CampaignPreset) => void;
  onApplyAdset: (next: AdsetPreset) => void;
  onAdvancedTargetingSync?: (json: string) => void;
  showDefaultPresetWarning?: boolean;
  creativeAssetId?: string | null;
  creativeGroupLabel?: string;
  currentCreative?: CreativeFields;
  onApplyCreative?: (patch: Record<string, string>) => void;
};

export function MissRobustaPanel({
  mode,
  activePresetTab = 'campaign',
  subtitle = 'Meta Ads setup assistant',
  presetDisabled,
  creativeDisabled,
  adType,
  tone,
  onAdTypeChange,
  onToneChange,
  draftCampaign,
  draftAdset,
  onApplyCampaign,
  onApplyAdset,
  onAdvancedTargetingSync,
  showDefaultPresetWarning,
  creativeAssetId,
  creativeGroupLabel,
  currentCreative,
  onApplyCreative,
}: MissRobustaPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div className="glass-card-elevated flex h-[min(560px,85vh)] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-2xl">
          <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-3">
            <Image
              src="/mascot/Robust.png"
              alt="Miss Robusta"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Miss Robusta</p>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="glass-button p-1.5"
              aria-label="Close"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
            {mode === 'preset' ? (
              <PresetModeRenderer
                activePresetTab={activePresetTab}
                adType={adType}
                tone={tone}
                onAdTypeChange={onAdTypeChange}
                onToneChange={onToneChange}
                draftCampaign={draftCampaign}
                draftAdset={draftAdset}
                onApplyCampaign={onApplyCampaign}
                onApplyAdset={onApplyAdset}
                onAdvancedTargetingSync={onAdvancedTargetingSync}
                showDefaultWarning={showDefaultPresetWarning}
                disabled={presetDisabled}
              />
            ) : (
              <CreativeModeRenderer
                adType={adType}
                tone={tone}
                onAdTypeCapture={onAdTypeChange}
                onToneCapture={onToneChange}
                assetId={creativeAssetId ?? null}
                groupLabel={creativeGroupLabel}
                currentCreative={currentCreative}
                onApply={(patch) => onApplyCreative?.(patch)}
                disabled={creativeDisabled}
              />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'group relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300',
          'glass-button-primary ring-4 ring-clipfox-primary/20 hover:ring-clipfox-primary/40',
        ].join(' ')}
        aria-label="Open Miss Robusta"
      >
        {open ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <Image
            src="/mascot/Robust.png"
            alt="Miss Robusta"
            width={40}
            height={40}
            className="h-full w-full rounded-full object-cover"
            unoptimized
          />
        )}
      </button>
    </div>
  );
}
