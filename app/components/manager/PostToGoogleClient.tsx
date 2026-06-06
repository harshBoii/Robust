'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { PlatformPicker } from '@/app/components/ads/PlatformPicker';
import {
  GoogleSearchPreviewCard,
} from '@/app/components/createAd/GoogleSearchPreviewCard';
import {
  GoogleDisplayPreviewCard,
} from '@/app/components/createAd/GoogleDisplayPreviewCard';
import {
  GooglePmaxPreviewCard,
} from '@/app/components/createAd/GooglePmaxPreviewCard';
import type { GoogleCampaignType } from '@/lib/ads/platform';

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = { id: string; name: string; campaignType: string; status?: string | null };
type AdGroup = { id: string; name: string; status?: string | null };
type Preset = { id: string; name: string };
type JobStatus = { id: string; status: string; lastError?: string | null };

type CreativeState = {
  headlines: string[];
  descriptions: string[];
  longHeadline: string;
  businessName: string;
  finalUrl: string;
  path1: string;
  path2: string;
};

const DEFAULT_CREATIVE: CreativeState = {
  headlines: ['', '', ''],
  descriptions: ['', ''],
  longHeadline: '',
  businessName: '',
  finalUrl: '',
  path1: '',
  path2: '',
};

type Step =
  | 'campaignType'
  | 'campaign'
  | 'adGroup'
  | 'creative'
  | 'preview'
  | 'publish';

const STEPS_SEARCH: Step[] = ['campaignType', 'campaign', 'adGroup', 'creative', 'preview', 'publish'];
const STEPS_DISPLAY: Step[] = ['campaignType', 'campaign', 'adGroup', 'creative', 'preview', 'publish'];
const STEPS_PMAX: Step[] = ['campaignType', 'campaign', 'creative', 'preview', 'publish'];

function stepsFor(ct: GoogleCampaignType): Step[] {
  if (ct === 'PERFORMANCE_MAX') return STEPS_PMAX;
  if (ct === 'SEARCH') return STEPS_SEARCH;
  return STEPS_DISPLAY;
}

const STEP_LABELS: Record<Step, string> = {
  campaignType: 'Campaign Type',
  campaign: 'Campaign',
  adGroup: 'Ad Group',
  creative: 'Creative',
  preview: 'Preview',
  publish: 'Publish',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostToGoogleClient() {
  const [campaignType, setCampaignType] = useState<GoogleCampaignType>('DISPLAY');
  const [step, setStep] = useState<Step>('campaignType');
  const steps = stepsFor(campaignType);
  const stepIdx = steps.indexOf(step);

  // Campaign
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignPresets, setCampaignPresets] = useState<Preset[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [campaignLoading, setCampaignLoading] = useState(false);

  // Ad Group
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [adGroupPresets, setAdGroupPresets] = useState<Preset[]>([]);
  const [selectedAdGroupId, setSelectedAdGroupId] = useState('');
  const [adGroupLoading, setAdGroupLoading] = useState(false);

  // Creative
  const [creative, setCreative] = useState<CreativeState>(DEFAULT_CREATIVE);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goNext = () => {
    const next = steps[stepIdx + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = steps[stepIdx - 1];
    if (prev) setStep(prev);
  };

  // Load campaigns + presets when entering campaign step
  useEffect(() => {
    if (step !== 'campaign') return;
    setCampaignLoading(true);
    Promise.all([
      apiFetch<{ campaigns: Campaign[] }>('/api/google-ads/campaigns'),
      apiFetch<{ presets: Preset[] }>('/api/presets/google/campaign'),
    ])
      .then(([c, p]) => {
        setCampaigns((c.campaigns ?? []).filter((x) => x.campaignType === campaignType));
        setCampaignPresets(p.presets ?? []);
      })
      .catch(() => null)
      .finally(() => setCampaignLoading(false));
  }, [step, campaignType]);

  // Load ad groups when entering adGroup step
  useEffect(() => {
    if (step !== 'adGroup' || !selectedCampaignId) return;
    setAdGroupLoading(true);
    Promise.all([
      apiFetch<{ adGroups: AdGroup[] }>(`/api/google-ads/ad-groups?campaignId=${selectedCampaignId}`),
      apiFetch<{ presets: Preset[] }>('/api/presets/google/ad-group'),
    ])
      .then(([ag, p]) => {
        setAdGroups(ag.adGroups ?? []);
        setAdGroupPresets(p.presets ?? []);
      })
      .catch(() => null)
      .finally(() => setAdGroupLoading(false));
  }, [step, selectedCampaignId]);

  // Poll job status
  useEffect(() => {
    if (!jobIds.length) return;
    const poll = () => {
      apiFetch<{ jobs: JobStatus[] }>(`/api/google-ads/publish/jobs?ids=${jobIds.join(',')}`)
        .then((d) => {
          setJobStatuses(d.jobs ?? []);
          const allDone = (d.jobs ?? []).every(
            (j) => j.status === 'PUBLISHED' || j.status === 'FAILED',
          );
          if (allDone && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        })
        .catch(() => null);
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobIds]);

  const createCampaignFromPreset = async (presetId: string) => {
    const res = await apiFetch<{ campaign: Campaign }>('/api/google-ads/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId }),
    });
    setCampaigns((prev) => [res.campaign, ...prev]);
    setSelectedCampaignId(res.campaign.id);
  };

  const createAdGroupFromPreset = async (presetId: string) => {
    const res = await apiFetch<{ adGroup: AdGroup }>('/api/google-ads/ad-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId, campaignId: selectedCampaignId }),
    });
    setAdGroups((prev) => [res.adGroup, ...prev]);
    setSelectedAdGroupId(res.adGroup.id);
  };

  const handlePublish = async (scheduledAt?: string) => {
    setPublishing(true);
    setPublishError(null);
    try {
      const groups = [
        {
          adGroupId: campaignType !== 'PERFORMANCE_MAX' ? selectedAdGroupId : undefined,
          headlines: creative.headlines.filter(Boolean),
          descriptions: creative.descriptions.filter(Boolean),
          longHeadline: creative.longHeadline || undefined,
          finalUrl: creative.finalUrl,
        },
      ];

      const res = await apiFetch<{ jobIds: string[] }>('/api/google-ads/publish/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          campaignType,
          scheduledAt: scheduledAt ?? null,
          groups,
        }),
      });
      setJobIds(res.jobIds ?? []);
      setStep('publish');

      // Trigger worker
      void fetch('/api/internal/worker/publish-jobs?platform=google', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const selectedAdGroup = adGroups.find((ag) => ag.id === selectedAdGroupId);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Step bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => i < stepIdx && setStep(s)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : i < stepIdx
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground cursor-default',
              ].join(' ')}
            >
              {i + 1}. {STEP_LABELS[s]}
            </button>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground text-xs">›</span>
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'campaignType' && (
          <div className="space-y-4 max-w-xl">
            <h2 className="text-base font-semibold">Select campaign type</h2>
            <PlatformPicker
              platform="GOOGLE"
              googleCampaignType={campaignType}
              onPlatformChange={() => {/* locked to GOOGLE */}}
              onCampaignTypeChange={setCampaignType}
            />
          </div>
        )}

        {step === 'campaign' && (
          <div className="space-y-4 max-w-xl">
            <h2 className="text-base font-semibold">Campaign</h2>
            {campaignLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                {campaigns.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Existing</p>
                    <div className="grid gap-2">
                      {campaigns.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCampaignId(c.id)}
                          className={[
                            'flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-all',
                            selectedCampaignId === c.id
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border bg-card hover:border-primary/50',
                          ].join(' ')}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{c.campaignType}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {campaignPresets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Create from preset</p>
                    <div className="grid gap-2">
                      {campaignPresets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => void createCampaignFromPreset(p.id)}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-left text-sm hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <span className="text-primary font-semibold text-lg leading-none">+</span>
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {campaigns.length === 0 && campaignPresets.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No campaigns found. Create a campaign preset in Manager › Presets first.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {step === 'adGroup' && (
          <div className="space-y-4 max-w-xl">
            <h2 className="text-base font-semibold">Ad Group</h2>
            {adGroupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                {adGroups.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Existing</p>
                    <div className="grid gap-2">
                      {adGroups.map((ag) => (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => setSelectedAdGroupId(ag.id)}
                          className={[
                            'rounded-xl border p-3 text-left text-sm transition-all',
                            selectedAdGroupId === ag.id
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border bg-card hover:border-primary/50',
                          ].join(' ')}
                        >
                          {ag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {adGroupPresets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Create from preset</p>
                    <div className="grid gap-2">
                      {adGroupPresets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => void createAdGroupFromPreset(p.id)}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-left text-sm hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <span className="text-primary font-semibold text-lg leading-none">+</span>
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'creative' && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-semibold">Creative</h2>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Final URL <span className="text-red-500">*</span>
              </label>
              <input
                value={creative.finalUrl}
                onChange={(e) => setCreative((p) => ({ ...p, finalUrl: e.target.value }))}
                placeholder="https://example.com/landing"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {campaignType !== 'PERFORMANCE_MAX' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1">Path 1</label>
                  <input
                    value={creative.path1}
                    onChange={(e) => setCreative((p) => ({ ...p, path1: e.target.value.slice(0, 15) }))}
                    placeholder="products"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold mb-1">Path 2</label>
                  <input
                    value={creative.path2}
                    onChange={(e) => setCreative((p) => ({ ...p, path2: e.target.value.slice(0, 15) }))}
                    placeholder="sale"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-2">
                Headlines ({creative.headlines.length}/{campaignType === 'SEARCH' ? 15 : 5})
              </label>
              <div className="space-y-1.5">
                {creative.headlines.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={h}
                      onChange={(e) => {
                        const updated = [...creative.headlines];
                        updated[i] = e.target.value;
                        setCreative((p) => ({ ...p, headlines: updated }));
                      }}
                      placeholder={`Headline ${i + 1}${i < 3 ? ' (required)' : ''}`}
                      maxLength={30}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground self-center w-8 text-right">
                      {h.length}/30
                    </span>
                  </div>
                ))}
              </div>
              {creative.headlines.length < (campaignType === 'SEARCH' ? 15 : 5) && (
                <button
                  type="button"
                  onClick={() => setCreative((p) => ({ ...p, headlines: [...p.headlines, ''] }))}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  + Add headline
                </button>
              )}
            </div>

            {(campaignType === 'DISPLAY' || campaignType === 'PERFORMANCE_MAX') && (
              <div>
                <label className="block text-xs font-semibold mb-1">Long Headline</label>
                <input
                  value={creative.longHeadline}
                  onChange={(e) => setCreative((p) => ({ ...p, longHeadline: e.target.value }))}
                  placeholder="Up to 90 characters"
                  maxLength={90}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-2">
                Descriptions ({creative.descriptions.length}/{campaignType === 'SEARCH' ? 4 : 5})
              </label>
              <div className="space-y-1.5">
                {creative.descriptions.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={d}
                      onChange={(e) => {
                        const updated = [...creative.descriptions];
                        updated[i] = e.target.value;
                        setCreative((p) => ({ ...p, descriptions: updated }));
                      }}
                      placeholder={`Description ${i + 1}${i < 2 ? ' (required)' : ''}`}
                      maxLength={90}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground self-center w-8 text-right">
                      {d.length}/90
                    </span>
                  </div>
                ))}
              </div>
              {creative.descriptions.length < (campaignType === 'SEARCH' ? 4 : 5) && (
                <button
                  type="button"
                  onClick={() => setCreative((p) => ({ ...p, descriptions: [...p.descriptions, ''] }))}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  + Add description
                </button>
              )}
            </div>

            {(campaignType === 'DISPLAY' || campaignType === 'PERFORMANCE_MAX') && (
              <div>
                <label className="block text-xs font-semibold mb-1">Business Name</label>
                <input
                  value={creative.businessName}
                  onChange={(e) => setCreative((p) => ({ ...p, businessName: e.target.value }))}
                  placeholder="Your brand name"
                  maxLength={25}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Preview</h2>
            <div className="flex flex-wrap gap-4">
              {campaignType === 'SEARCH' && (
                <GoogleSearchPreviewCard
                  headlines={creative.headlines.filter(Boolean)}
                  descriptions={creative.descriptions.filter(Boolean)}
                  finalUrl={creative.finalUrl}
                  path1={creative.path1 || undefined}
                  path2={creative.path2 || undefined}
                />
              )}
              {campaignType === 'DISPLAY' && (
                <GoogleDisplayPreviewCard
                  headlines={creative.headlines.filter(Boolean)}
                  longHeadline={creative.longHeadline || undefined}
                  descriptions={creative.descriptions.filter(Boolean)}
                  businessName={creative.businessName || undefined}
                  finalUrl={creative.finalUrl}
                />
              )}
              {campaignType === 'PERFORMANCE_MAX' && (
                <GooglePmaxPreviewCard
                  headlines={creative.headlines.filter(Boolean)}
                  longHeadline={creative.longHeadline || undefined}
                  descriptions={creative.descriptions.filter(Boolean)}
                  businessName={creative.businessName || undefined}
                  finalUrl={creative.finalUrl}
                />
              )}
            </div>

            <div className="max-w-sm rounded-xl border border-border bg-card p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-medium">Google Ads</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{campaignType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campaign</span>
                <span className="font-medium truncate max-w-[160px]">{selectedCampaign?.name ?? '—'}</span>
              </div>
              {selectedAdGroup && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ad Group</span>
                  <span className="font-medium truncate max-w-[160px]">{selectedAdGroup.name}</span>
                </div>
              )}
            </div>

            {publishError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {publishError}
              </div>
            )}
          </div>
        )}

        {step === 'publish' && (
          <div className="space-y-4 max-w-lg">
            <h2 className="text-base font-semibold">Publishing</h2>
            {jobStatuses.length === 0 ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-2">
                {jobStatuses.map((j) => (
                  <div
                    key={j.id}
                    className={[
                      'flex items-center gap-3 rounded-xl border p-3 text-sm',
                      j.status === 'PUBLISHED' ? 'border-emerald-500/30 bg-emerald-500/5' : '',
                      j.status === 'FAILED' ? 'border-red-500/30 bg-red-500/5' : '',
                      j.status === 'PROCESSING' || j.status === 'QUEUED' ? 'border-border bg-card' : '',
                    ].join(' ')}
                  >
                    {j.status === 'PUBLISHED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : j.status === 'FAILED' ? (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    ) : j.status === 'PROCESSING' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{j.status.toLowerCase()}</p>
                      {j.lastError && (
                        <p className="text-[11px] text-red-600 truncate">{j.lastError}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      {step !== 'publish' && (
        <div className="flex items-center justify-between border-t border-border pt-4 shrink-0">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIdx === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing || !creative.finalUrl || creative.headlines.filter(Boolean).length < 3}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish Now
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={
                (step === 'campaign' && !selectedCampaignId) ||
                (step === 'adGroup' && !selectedAdGroupId && campaignType !== 'PERFORMANCE_MAX')
              }
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
