'use client';

import { useCallback, useMemo, useState } from 'react';

import type { CreativeFields, GroupModel } from './types';
import { CREATE_AD_STEPS, type CreateAdStep, StepBar } from './shared';

import UploadStep from './steps/UploadStep';
import GroupsStep from './steps/GroupsStep';
import CampaignStep from './steps/CampaignStep';
import AdSetMappingStep from './steps/AdSetMappingStep';
import CreativeFieldsStep from './steps/CreativeFieldsStep';
import PreviewStep from './steps/PreviewStep';
import PublishStep from './steps/PublishStep';

function defaultCreative(): CreativeFields {
  return {
    headline: '',
    primaryText: '',
    description: '',
    landingUrl: '',
    ctaType: 'LEARN_MORE',
    pixelId: '',
  };
}

export default function CreateAdWizard({ companyId }: { companyId: string }) {
  const [step, setStep] = useState<CreateAdStep>('Upload');
  const stepIndex = CREATE_AD_STEPS.indexOf(step);

  const [bulkUploadId, setBulkUploadId] = useState<string>('');
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');
  const [groups, setGroups] = useState<GroupModel[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [publishedJobIds, setPublishedJobIds] = useState<string[]>([]);

  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);

  const canNext = useMemo(() => {
    if (step === 'Upload') return Boolean(bulkUploadId);
    if (step === 'Groups') return includedGroups.length > 0;
    if (step === 'Campaign') return Boolean(campaignId);
    if (step === 'Ad Sets') return includedGroups.every((g) => Boolean(g.adSetId));
    if (step === 'Creatives') {
      return includedGroups.every((g) =>
        Boolean(g.creative.headline.trim()) && Boolean(g.creative.landingUrl.trim()),
      );
    }
    return true;
  }, [step, bulkUploadId, includedGroups, campaignId]);

  const next = useCallback(() => {
    if (!canNext) return;
    setError(null);
    setStep(CREATE_AD_STEPS[Math.min(CREATE_AD_STEPS.length - 1, stepIndex + 1)]);
  }, [canNext, stepIndex]);

  const prev = useCallback(() => {
    setError(null);
    setStep(CREATE_AD_STEPS[Math.max(0, stepIndex - 1)]);
  }, [stepIndex]);

  const upsertGroups = useCallback((nextGroups: GroupModel[]) => {
    setGroups((prev) => {
      if (prev.length === 0) return nextGroups;
      const prevById = new Map(prev.map((g) => [g.bucketId, g]));
      return nextGroups.map((g) => {
        const old = prevById.get(g.bucketId);
        if (!old) return g;
        return {
          ...g,
          included: old.included,
          adSetId: old.adSetId,
          creative: old.creative ?? defaultCreative(),
        };
      });
    });
  }, []);

  const onChangeGroupAdSet = useCallback((bucketId: string, adSetId: string) => {
    setGroups((prev) => prev.map((g) => (g.bucketId === bucketId ? { ...g, adSetId } : g)));
  }, []);

  const onChangeCreative = useCallback((bucketId: string, patch: Partial<CreativeFields>) => {
    setGroups((prev) => prev.map((g) => {
      if (g.bucketId !== bucketId) return g;
      return { ...g, creative: { ...g.creative, ...patch } };
    }));
  }, []);

  const onCopyFromPrevious = useCallback((bucketId: string) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.bucketId === bucketId);
      if (idx <= 0) return prev;
      const source = prev[idx - 1]?.creative;
      if (!source) return prev;
      return prev.map((g, i) => (i === idx ? { ...g, creative: { ...source } } : g));
    });
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Meta Ads
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Create Ad</h1>
          <p className="text-sm text-muted-foreground">
            Upload creatives, map groups to ad sets, preview, and publish to Meta.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            className="glass-button flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!canNext || stepIndex >= CREATE_AD_STEPS.length - 1}
            className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="glass-card px-6 py-5">
        <StepBar steps={CREATE_AD_STEPS} current={step} />
      </div>

      {(bulkUploadId || campaignId || includedGroups.length > 0) ? (
        <div className="animate-fade-up mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-background/30 px-4 py-2.5">
          <span className="font-ui text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Selected
          </span>
          {bulkUploadId ? (
            <span className="glass-badge border-border/50 bg-muted text-muted-foreground">
              Upload {bulkUploadId}
            </span>
          ) : null}
          {campaignId ? (
            <span className="glass-badge border-primary/20 bg-primary/8 text-primary">
              Campaign {campaignId}
            </span>
          ) : null}
          {includedGroups.length > 0 ? (
            <span className="glass-badge border-border/50 bg-muted text-muted-foreground">
              {includedGroups.length} group{includedGroups.length !== 1 ? 's' : ''}
            </span>
          ) : null}
          {publishedJobIds.length > 0 ? (
            <span className="glass-badge border-clipfox-primary/20 bg-clipfox-primary/8 text-clipfox-primary">
              {publishedJobIds.length} job{publishedJobIds.length !== 1 ? 's' : ''} created
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="animate-fade-up mt-3 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="glass-card mt-3 overflow-hidden">
        <div className="p-6">
          {step === 'Upload' ? (
            <UploadStep
              companyId={companyId}
              onError={(m) => setError(m)}
              onUploaded={({ bulkUploadId: id, assetIds }) => {
                setBulkUploadId(id);
                setUploadedAssetIds(assetIds);
                setStep('Groups');
              }}
            />
          ) : null}

          {step === 'Groups' ? (
            <GroupsStep
              bulkUploadId={bulkUploadId}
              uploadedAssetIds={uploadedAssetIds}
              onError={(m) => setError(m)}
              onGroupsReady={(gs) => upsertGroups(gs)}
            />
          ) : null}

          {step === 'Campaign' ? (
            <CampaignStep
              selectedCampaignId={campaignId}
              onChangeCampaignId={setCampaignId}
              onError={(m) => setError(m)}
            />
          ) : null}

          {step === 'Ad Sets' ? (
            <AdSetMappingStep
              campaignId={campaignId}
              groups={groups}
              onChangeGroupAdSet={onChangeGroupAdSet}
              onError={(m) => setError(m)}
            />
          ) : null}

          {step === 'Creatives' ? (
            <CreativeFieldsStep
              groups={groups}
              onChangeCreative={onChangeCreative}
              onCopyFromPrevious={onCopyFromPrevious}
            />
          ) : null}

          {step === 'Preview' ? (
            <PreviewStep groups={groups} />
          ) : null}

          {step === 'Publish' ? (
            <PublishStep
              campaignId={campaignId}
              groups={groups}
              onPublished={(ids) => setPublishedJobIds(ids)}
              onError={(m) => setError(m)}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 px-6 py-4">
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            className="glass-button flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            Back
          </button>
          <span className="font-ui text-[11px] text-muted-foreground">
            Step {stepIndex + 1} of {CREATE_AD_STEPS.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={!canNext || stepIndex >= CREATE_AD_STEPS.length - 1}
            className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

