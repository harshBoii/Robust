'use client';

import { useState } from 'react';

import { AdsetPresetEditor } from './adset-preset-editor';
import { CampaignPresetEditor } from './campaign-preset-editor';
import { persistAdsetPresetDraft, persistCampaignPresetDraft } from './save-preset';
import type { AdsetPreset, CampaignPreset, MetaCampaignOption } from './types';

type BaseProps = {
  presetName: string;
  saving?: boolean;
  saveError?: string | null;
  onSaveError?: (message: string | null) => void;
};

type CampaignProps = BaseProps & {
  kind: 'campaign';
  draft: CampaignPreset;
  onDraftChange: (next: CampaignPreset | ((prev: CampaignPreset) => CampaignPreset)) => void;
  onSaved?: (draft: CampaignPreset) => void;
};

type AdsetProps = BaseProps & {
  kind: 'adset';
  draft: AdsetPreset;
  onDraftChange: (next: AdsetPreset | ((prev: AdsetPreset) => AdsetPreset)) => void;
  metaCampaigns: MetaCampaignOption[];
  advancedTargetingJson: string;
  onAdvancedTargetingJsonChange: (raw: string) => void;
  onSaved?: (draft: AdsetPreset) => void;
};

export type PostPresetFieldsPanelProps = CampaignProps | AdsetProps;

export function PostPresetFieldsPanel(props: PostPresetFieldsPanelProps) {
  const [saving, setSaving] = useState(false);

  const savePreset = async () => {
    setSaving(true);
    props.onSaveError?.(null);
    try {
      if (props.kind === 'campaign') {
        const result = await persistCampaignPresetDraft(props.draft.id, props.draft);
        if (!result.ok) {
          props.onSaveError?.(result.error);
          return;
        }
        props.onSaved?.(props.draft);
      } else {
        const result = await persistAdsetPresetDraft(props.draft.id, props.draft, {
          advancedTargetingJson: props.advancedTargetingJson,
          metaCampaigns: props.metaCampaigns,
        });
        if (!result.ok) {
          props.onSaveError?.(result.error);
          return;
        }
        props.onSaved?.(props.draft);
      }
    } catch (e) {
      props.onSaveError?.(e instanceof Error ? e.message : 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const isSaving = saving || props.saving;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Preset settings</h3>
          <p className="text-sm text-muted-foreground">
            Review and edit <span className="font-medium text-foreground">{props.presetName}</span> before
            creating. Changes apply when you create, or save them to the preset with Save preset.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void savePreset()}
          disabled={isSaving}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save preset'}
        </button>
      </div>

      {props.saveError && (
        <div className="mx-5 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {props.saveError}
        </div>
      )}

      <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto p-5">
        {props.kind === 'campaign' ? (
          <CampaignPresetEditor value={props.draft} onChange={props.onDraftChange} showDefaultToggle={false} />
        ) : (
          <AdsetPresetEditor
            value={props.draft}
            onChange={props.onDraftChange}
            metaCampaigns={props.metaCampaigns}
            advancedTargetingJson={props.advancedTargetingJson}
            onAdvancedTargetingJsonChange={props.onAdvancedTargetingJsonChange}
            showIdentityExtras={false}
          />
        )}
      </div>
    </section>
  );
}
