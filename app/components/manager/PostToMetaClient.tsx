'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readApiJson } from '@/lib/api/read-json';
import { useToast } from '@/app/components/UI/ToastProvider';
import UploadStep from '@/app/components/createAd/steps/UploadStep';
import {
  GroupAdCreativesPanel,
  type AssetCreativeState,
  type BulkAdCreativeResultRow,
  type SavedAdCreative,
} from '@/app/components/manager/GroupAdCreativesPanel';
import { PostPresetFieldsPanel } from '@/app/components/manager/presets/PostPresetFieldsPanel';
import {
  formatPublishWorkerErrors,
  triggerPublishWorker,
} from '@/app/components/manager/triggerPublishWorker';
import { normalizeAdsetPreset, normalizeCampaignPreset } from '@/app/components/manager/presets/normalize';
import { persistAdsetPresetDraft, persistCampaignPresetDraft } from '@/app/components/manager/presets/save-preset';
import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { CreativeGroupAnalyzeDialog } from '@/app/components/assistant/CreativeGroupAnalyzeDialog';
import { MissRobustaPanel } from '@/app/components/assistant/MissRobustaPanel';
import { buildCreativeApplyPatch } from '@/lib/assistant/merge-preset-patch';
import { pickGroupVideoAssetId } from '@/lib/assistant/pick-group-video-asset';

/* ─────────────────────────────────────────── types ── */
type Campaign = { id: string; name: string; objective?: string; status?: string; bidStrategy?: string | null };
type AdSet = { id: string; name: string; status?: string };
type Preset = { id: string; name: string };
type AssetBucket = { id: string; label: string };
type Asset = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  playbackUrl?: string | null;
  resolution?: string | null;
  assetType: string;
  bulkUploadId: string | null;
  assetBucketId: string | null;
};
type JobRow = { id: string; status: string; lastError?: string | null };
type GalleryAssetApiRow = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  playbackUrl?: string | null;
  resolution?: string | null;
  assetType: string;
  bulkUploadId?: string | null;
  assetBucketId?: string | null;
  bulkUpload?: { id: string; name: string } | null;
};
type CreativeFields = {
  headline: string;
  primaryText: string;
  description: string;
  landingUrl: string;
  ctaType: string;
  pixelId: string;
};
type GroupModel = {
  groupId: string;
  label: string;
  included: boolean;
  adSetId: string;
  assets: Asset[];
  selectedAssetIds: string[];
  creative: CreativeFields;
  assetCreatives: Record<string, AssetCreativeState>;
};

function defaultAssetCreatives(assetIds: string[]): Record<string, AssetCreativeState> {
  return Object.fromEntries(assetIds.map((id) => [id, { status: 'none' as const }]));
}

function mergeAssetCreatives(
  prev: Record<string, AssetCreativeState>,
  assetIds: string[],
): Record<string, AssetCreativeState> {
  const next: Record<string, AssetCreativeState> = {};
  for (const id of assetIds) {
    next[id] = prev[id] ?? { status: 'none' };
  }
  return next;
}

async function json<T>(res: Response): Promise<T> {
  return readApiJson<T>(res);
}

/* ─────────────────────────────────────── step config ── */
const STEPS = ['Campaign', 'Ad Set', 'Media', 'Creative Fields', 'Preview', 'Publish'] as const;
type Step = (typeof STEPS)[number];

const CTA_OPTIONS = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'DOWNLOAD',
  'GET_QUOTE',
  'CONTACT_US',
  'BOOK_TRAVEL',
  'SUBSCRIBE',
] as const;

const STEP_META: Record<Step, { description: string; icon: ReactNode }> = {
  Campaign: {
    description: 'Choose an existing campaign or create one from a preset.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M15 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7.5L15 3z" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="15 3 15 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="13" x2="15" y2="13" strokeLinecap="round" />
        <line x1="9" y1="17" x2="11" y2="17" strokeLinecap="round" />
      </svg>
    ),
  },
  'Ad Set': {
    description: 'Pick a default ad set and optionally override it per group later.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  Media: {
    description: 'Select a bulk upload, include the right groups, and choose the assets to publish.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  'Creative Fields': {
    description: 'Fill in the ad copy and landing data for every included group.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M4 19.5V4a2 2 0 012-2h9l5 5v12.5a2 2 0 01-2 2H6a2 2 0 01-2-2z" strokeLinecap="round" />
        <path d="M14 2v6h6" strokeLinecap="round" />
        <path d="M8 12h8M8 16h6" strokeLinecap="round" />
      </svg>
    ),
  },
  Preview: {
    description: 'Review selected assets, placements, and the copy that will be sent.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  Publish: {
    description: 'Publish immediately or schedule for a future time.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const JOB_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  DONE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  ERROR: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
};

function jobStatusStyle(s: string) {
  return JOB_STATUS_STYLES[s.toUpperCase()] ?? 'bg-muted text-muted-foreground border-border';
}

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

/* ───────────────────────────────────── reusable ui ── */
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Card({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      {(title || description || action) && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="space-y-1">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ──────────────────────── Stepper (fixed top bar) ── */
function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-1">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step} className="flex flex-1 items-center gap-1 min-w-0">
              {/* Step pill */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {/* Circle */}
                <div
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                    isDone && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary/15 text-primary ring-1 ring-primary/40',
                    !isDone && !isCurrent && 'bg-muted text-muted-foreground',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isDone ? (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Label — hidden on small screens */}
                <span
                  className={cx(
                    'hidden truncate text-[11px] font-medium sm:block',
                    isCurrent ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {step}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cx(
                    'h-px w-3 shrink-0 rounded-full transition-colors',
                    isDone ? 'bg-primary/50' : 'bg-border',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: 'folder' | 'alert' | 'image';
  title: string;
  description?: string;
}) {
  const icons: Record<string, ReactNode> = {
    folder: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" />
      </svg>
    ),
    alert: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    image: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <div className="text-muted-foreground/60">{icons[icon]}</div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function MediaGroupSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-background">
          {/* group header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
          </div>
          {/* asset grid */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="overflow-hidden rounded-2xl border border-border">
                <div className="aspect-square w-full animate-pulse bg-muted" />
                <div className="space-y-1.5 p-3">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionCard({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-150',
        selected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border bg-background hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      {/* reserve space for the check circle on the right */}
      <div className="min-w-0 pr-7">
        <p className="truncate text-sm font-medium text-foreground" title={title}>
          {title}
        </p>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        )}
      </div>

      <div
        className={cx(
          'absolute right-3 top-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
        )}
      >
        {selected && (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}
function InlinePresetCreate({
  presets,
  value,
  onChange,
  onCreate,
  buttonLabel,
  loading,
}: {
  presets: Preset[];
  value: string;
  onChange: (value: string) => void;
  onCreate: () => Promise<void>;
  buttonLabel: string;
  loading: boolean;
}) {
  return (
    <Card title="Create from preset" description="Use an existing preset to create a new entity without leaving this screen.">
      {presets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No presets available.</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none ring-0 transition focus:border-primary"
          >
            <option value="">Select a preset…</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onCreate}
            disabled={!value || loading}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating…' : buttonLabel}
          </button>
        </div>
      )}
    </Card>
  );
}

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-foreground">
      {children}
      {optional && <span className="ml-1 text-muted-foreground">(optional)</span>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition',
        'placeholder:text-muted-foreground focus:border-primary',
        props.className,
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        'min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition',
        'placeholder:text-muted-foreground focus:border-primary',
        props.className,
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary',
        props.className,
      )}
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[65%] truncate text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function StatusPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', className)}>
      {children}
    </span>
  );
}

/* ══════════════════════════════════ main component ══ */
export default function PostToMetaClient({ companyId }: { companyId: string }) {
  const toast = useToast();

  const [step, setStep] = useState<Step>('Campaign');
  const stepIndex = STEPS.indexOf(step);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [campaignPresets, setCampaignPresets] = useState<Preset[]>([]);
  const [adsetPresets, setAdsetPresets] = useState<Preset[]>([]);
  const [campaignPresetRecords, setCampaignPresetRecords] = useState<CampaignPreset[]>([]);
  const [adsetPresetRecords, setAdsetPresetRecords] = useState<AdsetPreset[]>([]);
  const [draftCampaignPreset, setDraftCampaignPreset] = useState<CampaignPreset | null>(null);
  const [draftAdsetPreset, setDraftAdsetPreset] = useState<AdsetPreset | null>(null);
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState('');
  const [presetSaveError, setPresetSaveError] = useState<string | null>(null);

  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedAdSetId, setSelectedAdSetId] = useState('');
  const [useAdSetPerGroup, setUseAdSetPerGroup] = useState(false);

  const [bulkUploads, setBulkUploads] = useState<{ id: string; name: string }[]>([]);
  const [activeBulkUploadId, setActiveBulkUploadId] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [buckets, setBuckets] = useState<AssetBucket[]>([]);
  const [groups, setGroups] = useState<GroupModel[]>([]);

  const [scheduledAt, setScheduledAt] = useState('');
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [jobRows, setJobRows] = useState<JobRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState<string | null>(null);

  const [campaignPresetId, setCampaignPresetId] = useState('');
  const [adsetPresetId, setAdsetPresetId] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [creatingAdSet, setCreatingAdSet] = useState(false);
  const [savedAdCreatives, setSavedAdCreatives] = useState<SavedAdCreative[]>([]);
  const [loadingAdCreatives, setLoadingAdCreatives] = useState(false);
  const [bulkCreativeResultsByGroup, setBulkCreativeResultsByGroup] = useState<
    Record<string, BulkAdCreativeResultRow[]>
  >({});
  const [creatingAllGroupId, setCreatingAllGroupId] = useState<string | null>(null);
  const [robustaAdType, setRobustaAdType] = useState<string | null>(null);
  const [robustaTone, setRobustaTone] = useState<string | null>(null);
  const [activeCreativeGroupId, setActiveCreativeGroupId] = useState<string | null>(null);
  const [creativeAnalyzeDialogOpen, setCreativeAnalyzeDialogOpen] = useState(false);
  const [creativeAnalyzeSeedGroupId, setCreativeAnalyzeSeedGroupId] = useState<string | null>(null);
  const [creativeAnalyzing, setCreativeAnalyzing] = useState(false);
  /** Skip one preset-id → draft sync after Miss Robusta applies (avoids DB preset overwriting merge). */
  const skipCampaignPresetSyncRef = useRef(false);
  const skipAdsetPresetSyncRef = useRef(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId],
  );
  const selectedAdSet = useMemo(
    () => adSets.find((a) => a.id === selectedAdSetId),
    [adSets, selectedAdSetId],
  );
  const activeBulkUpload = useMemo(
    () => bulkUploads.find((b) => b.id === activeBulkUploadId),
    [bulkUploads, activeBulkUploadId],
  );
  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);

  const missRobustaMode = useMemo<'preset' | 'creative'>(() => {
    if (step === 'Creative Fields') return 'creative';
    return 'preset';
  }, [step]);

  const creativeAssistantGroup = useMemo(() => {
    if (activeCreativeGroupId) {
      return includedGroups.find((g) => g.groupId === activeCreativeGroupId) ?? includedGroups[0] ?? null;
    }
    return includedGroups[0] ?? null;
  }, [includedGroups, activeCreativeGroupId]);

  const creativeAssistantAssetId = useMemo(() => {
    if (!creativeAssistantGroup) return null;
    return pickGroupVideoAssetId(creativeAssistantGroup);
  }, [creativeAssistantGroup]);

  const totalSelectedAssets = useMemo(
    () => includedGroups.reduce((sum, group) => sum + group.selectedAssetIds.length, 0),
    [includedGroups],
  );

  const updateGroup = useCallback((groupId: string, patch: Partial<GroupModel>) => {
    setGroups((prev) => prev.map((group) => (group.groupId === groupId ? { ...group, ...patch } : group)));
  }, []);

  const updateGroupCreative = useCallback((groupId: string, patch: Partial<CreativeFields>) => {
    setGroups((prev) =>
      prev.map((group) =>
        group.groupId === groupId ? { ...group, creative: { ...group.creative, ...patch } } : group,
      ),
    );
  }, []);

  const openCreativeAnalyzeDialog = useCallback((seedGroupId: string | null) => {
    setCreativeAnalyzeSeedGroupId(seedGroupId);
    setCreativeAnalyzeDialogOpen(true);
  }, []);

  const runCreativeAnalyzeForGroups = useCallback(
    async (groupIds: string[]) => {
      if (groupIds.length === 0) return;

      setCreativeAnalyzing(true);
      const adType =
        robustaAdType?.trim() || selectedCampaign?.objective?.trim() || 'OUTCOME_SALES';
      const tone = robustaTone?.trim() || 'general';

      let succeeded = 0;
      const failures: string[] = [];

      for (const groupId of groupIds) {
        const group = includedGroups.find((g) => g.groupId === groupId);
        if (!group) continue;

        const assetId = pickGroupVideoAssetId(group);
        if (!assetId) {
          failures.push(`${group.label}: no video asset`);
          continue;
        }

        try {
          const res = await fetch('/api/assistant/creative-suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetId,
              adType,
              tone,
              groupLabel: group.label,
            }),
          });
          const data = (await res.json()) as {
            headline?: string;
            primaryText?: string;
            description?: string;
            ctaType?: string;
            landingUrl?: string;
            skippedFields?: string[];
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? 'Analysis failed');

          const patch = buildCreativeApplyPatch(
            {
              headline: data.headline,
              primaryText: data.primaryText,
              description: data.description,
              ctaType: data.ctaType,
              landingUrl: data.landingUrl,
            },
            data.skippedFields ?? [],
          );
          updateGroupCreative(groupId, patch);
          succeeded += 1;
        } catch (e) {
          failures.push(
            `${group.label}: ${e instanceof Error ? e.message : 'Analysis failed'}`,
          );
        }
      }

      setCreativeAnalyzing(false);
      setCreativeAnalyzeDialogOpen(false);
      if (groupIds[0]) setActiveCreativeGroupId(groupIds[0]);

      if (succeeded > 0) {
        toast.push({
          kind: failures.length > 0 ? 'info' : 'success',
          title:
            failures.length > 0
              ? `Analyzed ${succeeded} of ${groupIds.length} groups`
              : `Analyzed ${succeeded} group${succeeded !== 1 ? 's' : ''}`,
          message:
            failures.length > 0
              ? failures.join(' · ')
              : 'Creative fields were filled from your videos.',
        });
      } else {
        toast.push({
          kind: 'error',
          title: 'Analysis failed',
          message: failures.join(' · ') || 'Could not analyze the selected groups.',
        });
      }
    },
    [
      includedGroups,
      robustaAdType,
      robustaTone,
      selectedCampaign?.objective,
      updateGroupCreative,
      toast,
    ],
  );

  const toggleAsset = useCallback((groupId: string, assetId: string) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.groupId !== groupId) return group;
        const next = new Set(group.selectedAssetIds);
        if (next.has(assetId)) next.delete(assetId);
        else next.add(assetId);
        const selectedAssetIds = [...next];
        return {
          ...group,
          selectedAssetIds,
          assetCreatives: mergeAssetCreatives(group.assetCreatives, selectedAssetIds),
        };
      }),
    );
  }, []);

  const canNext = useMemo(() => {
    if (step === 'Campaign') return Boolean(selectedCampaignId);
    if (step === 'Ad Set') return Boolean(selectedAdSetId);

    if (step === 'Media') {
      if (!activeBulkUploadId) return false;
      if (includedGroups.length === 0) return false;
      if (includedGroups.some((group) => group.selectedAssetIds.length === 0)) return false;
      if (useAdSetPerGroup && includedGroups.some((group) => !group.adSetId)) return false;
      return true;
    }

    if (step === 'Creative Fields') {
      if (includedGroups.length === 0) return false;
      return includedGroups.every(
        (group) => Boolean(group.creative.headline.trim()) && Boolean(group.creative.landingUrl.trim()),
      );
    }

    return true;
  }, [step, selectedCampaignId, selectedAdSetId, activeBulkUploadId, includedGroups, useAdSetPerGroup]);

  const validationMessage = useMemo(() => {
    if (step === 'Campaign' && !selectedCampaignId) return 'Select a campaign to continue.';
    if (step === 'Ad Set' && !selectedAdSetId) return 'Select an ad set to continue.';
    if (step === 'Media') {
      if (!activeBulkUploadId) return 'Select a bulk upload session.';
      if (includedGroups.length === 0) return 'Include at least one group.';
      if (includedGroups.some((group) => group.selectedAssetIds.length === 0)) {
        return 'Each included group needs at least one selected asset.';
      }
      if (useAdSetPerGroup && includedGroups.some((group) => !group.adSetId)) {
        return 'Choose an ad set for every included group.';
      }
    }
    if (step === 'Creative Fields') {
      if (includedGroups.length === 0) return 'Include at least one group before entering copy.';
      if (
        includedGroups.some(
          (group) => !group.creative.headline.trim() || !group.creative.landingUrl.trim(),
        )
      ) {
        return 'Headline and landing URL are required for every included group.';
      }
    }
    return null;
  }, [step, selectedCampaignId, selectedAdSetId, activeBulkUploadId, includedGroups, useAdSetPerGroup]);

  const next = useCallback(() => {
    if (!canNext) return;
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
  }, [canNext, stepIndex]);

  const prev = useCallback(() => {
    setStep(STEPS[Math.max(stepIndex - 1, 0)]);
  }, [stepIndex]);

  /* ── load base lists ── */
  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const [campaignResp, campaignPresetResp, adsetPresetResp] = await Promise.all([
          json<{ campaigns: Campaign[] }>(await fetch('/api/meta/campaigns', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/campaign', { credentials: 'include' })),
          json<{ presets: Preset[] }>(await fetch('/api/presets/adset', { credentials: 'include' })),
        ]);

        setCampaigns(campaignResp.campaigns ?? []);
        const campaignRecords = (campaignPresetResp.presets ?? []).map((p) => normalizeCampaignPreset(p));
        const adsetRecords = (adsetPresetResp.presets ?? []).map((p) => normalizeAdsetPreset(p));
        setCampaignPresetRecords(campaignRecords);
        setAdsetPresetRecords(adsetRecords);
        setCampaignPresets(campaignRecords.map((p) => ({ id: p.id, name: p.name })));
        setAdsetPresets(adsetRecords.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── load ad sets when campaign selected ── */
  useEffect(() => {
    if (!selectedCampaignId) {
      setAdSets([]);
      setSelectedAdSetId('');
      return;
    }

    void (async () => {
      try {
        const data = await json<{ adSets: AdSet[] }>(
          await fetch(`/api/meta/adsets?campaignId=${encodeURIComponent(selectedCampaignId)}`, {
            credentials: 'include',
          }),
        );
        setAdSets(data.adSets ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load ad sets');
      }
    })();
  }, [selectedCampaignId]);

  /* ── load assets for bulk upload dropdown ── */
  useEffect(() => {
    void (async () => {
      try {
        const resp = await json<{ assets: GalleryAssetApiRow[] }>(
          await fetch('/api/gallery/assets', { credentials: 'include' }),
        );

        const bulks = new Map<string, string>();
        for (const asset of resp.assets ?? []) {
          if (asset.bulkUpload?.id && asset.bulkUpload?.name) {
            bulks.set(asset.bulkUpload.id, asset.bulkUpload.name);
          }
        }

        setBulkUploads([...bulks.entries()].map(([id, name]) => ({ id, name })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load assets');
      }
    })();
  }, []);

  /* ── load buckets + group assets when upload changes ── */
  useEffect(() => {
    if (!activeBulkUploadId) {
      setBuckets([]);
      setGroups([]);
      setMediaLoading(false);
      return;
    }

    void (async () => {
      setMediaLoading(true);
      try {
        const [bucketResp, assetResp] = await Promise.all([
          json<{ buckets?: Array<{ id: string; label: string }> }>(
            await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(activeBulkUploadId)}/analyze`, {
              credentials: 'include',
            }),
          ),
          json<{ assets: GalleryAssetApiRow[] }>(
            await fetch(`/api/gallery/assets?bulkUploadId=${encodeURIComponent(activeBulkUploadId)}`, {
              credentials: 'include',
            }),
          ),
        ]);

        const nextBuckets: AssetBucket[] = (bucketResp.buckets ?? []).map((bucket) => ({
          id: bucket.id,
          label: bucket.label,
        }));

        const nextAssets: Asset[] = (assetResp.assets ?? []).map((asset) => ({
          id: asset.id,
          title: asset.title,
          thumbnailUrl: asset.thumbnailUrl ?? null,
          playbackUrl: asset.playbackUrl ?? null,
          resolution: asset.resolution ?? null,
          assetType: asset.assetType,
          bulkUploadId: asset.bulkUploadId ?? null,
          assetBucketId: asset.assetBucketId ?? null,
        }));

        const byBucket = new Map<string, Asset[]>();
        for (const asset of nextAssets) {
          if (!asset.assetBucketId) continue;
          if (!byBucket.has(asset.assetBucketId)) byBucket.set(asset.assetBucketId, []);
          byBucket.get(asset.assetBucketId)?.push(asset);
        }

        setBuckets(nextBuckets);

        setGroups((prev) => {
          const prevById = new Map(prev.map((group) => [group.groupId, group]));
          return nextBuckets.map((bucket) => {
            const old = prevById.get(bucket.id);
            const assets = byBucket.get(bucket.id) ?? [];

            return {
              groupId: bucket.id,
              label: bucket.label,
              included: old?.included ?? true,
              adSetId: old?.adSetId ?? selectedAdSetId,
              assets,
              selectedAssetIds: old?.selectedAssetIds?.filter((id) => assets.some((asset) => asset.id === id)) ?? [],
              creative: old?.creative ?? defaultCreative(),
              assetCreatives: mergeAssetCreatives(
                old?.assetCreatives ?? {},
                (old?.selectedAssetIds?.filter((id) => assets.some((a) => a.id === id)) ??
                  assets.map((a) => a.id)),
              ),
            } satisfies GroupModel;
          });
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load groups');
      } finally {
        setMediaLoading(false);
      }
    })();
  }, [activeBulkUploadId, selectedAdSetId]);

  const refreshSavedAdCreatives = useCallback(async () => {
    setLoadingAdCreatives(true);
    try {
      const data = await json<{ creatives: SavedAdCreative[] }>(
        await fetch('/api/meta/ad-creatives', { credentials: 'include' }),
      );
      setSavedAdCreatives(data.creatives ?? []);
    } catch {
      /* non-blocking */
    } finally {
      setLoadingAdCreatives(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 'Creative Fields') return;
    void refreshSavedAdCreatives();
  }, [step, refreshSavedAdCreatives]);

  const createAdCreativeForAsset = useCallback(
    async (groupId: string, assetId: string) => {
      const group = groups.find((g) => g.groupId === groupId);
      if (!group) return;

      const { headline, primaryText, description, landingUrl, ctaType, pixelId } = group.creative;

      setGroups((prev) =>
        prev.map((g) =>
          g.groupId !== groupId
            ? g
            : {
                ...g,
                assetCreatives: {
                  ...g.assetCreatives,
                  [assetId]: { status: 'creating' },
                },
              },
        ),
      );

      try {
        const data = await json<{ creative: SavedAdCreative & { metaCreativeId: string } }>(
          await fetch('/api/meta/ad-creatives', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetId,
              campaignId: selectedCampaignId || undefined,
              headline,
              primaryText: primaryText || headline,
              description: description || undefined,
              landingUrl,
              ctaType,
              pixelId: pixelId || undefined,
            }),
          }),
        );

        const creative = data.creative;
        setGroups((prev) =>
          prev.map((g) =>
            g.groupId !== groupId
              ? g
              : {
                  ...g,
                  assetCreatives: {
                    ...g.assetCreatives,
                    [assetId]: {
                      status: 'ready',
                      metaCreativeDbId: creative.id,
                      metaCreativeId: creative.metaCreativeId ?? undefined,
                    },
                  },
                },
          ),
        );
        await refreshSavedAdCreatives();
        toast.push({
          kind: 'success',
          title: 'Ad creative created',
          message: creative.metaCreativeId
            ? `Meta creative ${creative.metaCreativeId}`
            : 'Saved for publish',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create ad creative';
        setGroups((prev) =>
          prev.map((g) =>
            g.groupId !== groupId
              ? g
              : {
                  ...g,
                  assetCreatives: {
                    ...g.assetCreatives,
                    [assetId]: { status: 'error', error: msg },
                  },
                },
          ),
        );
        toast.push({ kind: 'error', title: 'Ad creative failed', message: msg });
      }
    },
    [groups, refreshSavedAdCreatives, selectedCampaignId, toast],
  );

  const createAllAdCreativesForGroup = useCallback(
    async (groupId: string) => {
      const group = groups.find((g) => g.groupId === groupId);
      if (!group) return;

      const { headline, primaryText, description, landingUrl, ctaType, pixelId } = group.creative;

      if (group.selectedAssetIds.length === 0) {
        toast.push({
          kind: 'error',
          title: 'No assets',
          message: 'Select at least one asset in the Media step.',
        });
        return;
      }

      const assetIdsToCreate = group.selectedAssetIds.filter(
        (assetId) => group.assetCreatives[assetId]?.status !== 'ready',
      );

      if (assetIdsToCreate.length === 0) {
        toast.push({
          kind: 'info',
          title: 'Already created',
          message: 'All selected assets already have Meta ad creatives. Use Recreate to replace one.',
        });
        return;
      }

      setCreatingAllGroupId(groupId);
      setGroups((prev) =>
        prev.map((g) => {
          if (g.groupId !== groupId) return g;
          const assetCreatives = { ...g.assetCreatives };
          for (const assetId of assetIdsToCreate) {
            assetCreatives[assetId] = { status: 'creating' };
          }
          return { ...g, assetCreatives };
        }),
      );

      try {
        const data = await json<{
          results: BulkAdCreativeResultRow[];
          summary: { total: number; created: number; failed: number };
        }>(
          await fetch('/api/meta/ad-creatives/bulk', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: selectedCampaignId || undefined,
              items: assetIdsToCreate.map((assetId) => ({
                assetId,
                headline,
                primaryText: primaryText || headline,
                description: description || undefined,
                landingUrl,
                ctaType,
                pixelId: pixelId || undefined,
              })),
            }),
          }),
        );

        setBulkCreativeResultsByGroup((prev) => ({
          ...prev,
          [groupId]: data.results ?? [],
        }));

        setGroups((prev) =>
          prev.map((g) => {
            if (g.groupId !== groupId) return g;
            const assetCreatives = { ...g.assetCreatives };
            for (const row of data.results ?? []) {
              if (row.ok && row.creative) {
                assetCreatives[row.assetId] = {
                  status: 'ready',
                  metaCreativeDbId: row.creative.id,
                  metaCreativeId: row.creative.metaCreativeId,
                };
              } else if (row.assetId) {
                assetCreatives[row.assetId] = {
                  status: 'error',
                  error: row.error ?? 'Failed',
                };
              }
            }
            return { ...g, assetCreatives };
          }),
        );

        await refreshSavedAdCreatives();

        const { created, failed, total } = data.summary ?? {
          total: data.results?.length ?? 0,
          created: 0,
          failed: 0,
        };
        const idList = (data.results ?? [])
          .filter((r) => r.ok && r.creative?.metaCreativeId)
          .map((r) => r.creative!.metaCreativeId)
          .join(', ');

        toast.push({
          kind: failed > 0 ? 'error' : 'success',
          title: `Ad creatives: ${created}/${total} created`,
          message:
            failed > 0
              ? `${failed} failed. See Meta API results below.`
              : idList
                ? `Meta creative ids: ${idList}`
                : 'Saved for publish',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Bulk create failed';
        setGroups((prev) =>
          prev.map((g) => {
            if (g.groupId !== groupId) return g;
            const assetCreatives = { ...g.assetCreatives };
            for (const assetId of assetIdsToCreate) {
              assetCreatives[assetId] = { status: 'error', error: msg };
            }
            return { ...g, assetCreatives };
          }),
        );
        toast.push({ kind: 'error', title: 'Create all failed', message: msg });
      } finally {
        setCreatingAllGroupId(null);
      }
    },
    [groups, refreshSavedAdCreatives, selectedCampaignId, toast],
  );

  const applySavedCreativeToAsset = useCallback(
    (groupId: string, assetId: string, creativeDbId: string) => {
      const saved = savedAdCreatives.find((c) => c.id === creativeDbId);
      if (!saved) return;
      setGroups((prev) =>
        prev.map((g) =>
          g.groupId !== groupId
            ? g
            : {
                ...g,
                assetCreatives: {
                  ...g.assetCreatives,
                  [assetId]: {
                    status: 'ready',
                    metaCreativeDbId: saved.id,
                    metaCreativeId: saved.metaCreativeId ?? undefined,
                  },
                },
              },
        ),
      );
    },
    [savedAdCreatives],
  );

  /* ── publish ── */
  const publish = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await json<{ jobIds: string[] }>(
        await fetch('/api/meta/publish/bulk', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: selectedCampaignId,
            scheduledAt: scheduledAt || undefined,
            groups: includedGroups.map((group) => {
              const assetCreatives: Record<string, string> = {};
              for (const assetId of group.selectedAssetIds) {
                const dbId = group.assetCreatives[assetId]?.metaCreativeDbId;
                if (dbId) assetCreatives[assetId] = dbId;
              }
              return {
                bucketId: group.groupId,
                assetIds: group.selectedAssetIds,
                adSetId: useAdSetPerGroup ? group.adSetId : selectedAdSetId,
                headline: group.creative.headline,
                primaryText: group.creative.primaryText,
                description: group.creative.description || undefined,
                landingUrl: group.creative.landingUrl,
                ctaType: group.creative.ctaType,
                pixelId: group.creative.pixelId || undefined,
                assetCreatives,
              };
            }),
          }),
        }),
      );

      setJobIds(resp.jobIds ?? []);
      toast.push({
        kind: 'success',
        title: scheduledAt ? 'Ads scheduled' : 'Ads queued',
        message: `${(resp.jobIds ?? []).length} job(s) created`,
      });
      setStep('Publish');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Publish failed';
      setError(msg);
      toast.push({ kind: 'error', title: 'Publish failed', message: msg });
    } finally {
      setLoading(false);
    }
  }, [includedGroups, scheduledAt, selectedAdSetId, selectedCampaignId, toast, useAdSetPerGroup]);

  const refreshJobRows = useCallback(async () => {
    if (!jobIds.length) return;
    const qs = new URLSearchParams({ ids: jobIds.join(',') });
    const data = await json<{ jobs: JobRow[] }>(
      await fetch(`/api/meta/publish/jobs?${qs.toString()}`, { credentials: 'include' }),
    );
    setJobRows(data.jobs ?? []);
  }, [jobIds]);

  const runPublishWorker = useCallback(async () => {
    setWorkerLoading(true);
    setWorkerError(null);
    try {
      const { processed } = await triggerPublishWorker(10);
      const failures = formatPublishWorkerErrors(processed);
      if (failures) setWorkerError(failures);
      await refreshJobRows();
    } catch (e) {
      setWorkerError(e instanceof Error ? e.message : 'Failed to process publish queue');
    } finally {
      setWorkerLoading(false);
    }
  }, [refreshJobRows]);

  /* ── SSE job tracking ── */
  useEffect(() => {
    if (!jobIds.length) return;

    let aborted = false;
    const ctrl = new AbortController();
    const qs = `ids=${encodeURIComponent(jobIds.join(','))}`;

    void (async () => {
      try {
        const res = await fetch(`/api/meta/publish/jobs?${qs}`, {
          method: 'POST',
          signal: ctrl.signal,
        });

        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const line = part.split('\n').find((row) => row.startsWith('data: '));
            if (!line) continue;

            const payload = JSON.parse(line.slice(6)) as { jobs?: JobRow[]; done?: boolean };
            if (payload.jobs) setJobRows(payload.jobs);
            if (payload.done) return;
          }
        }
      } catch {
        //
      }
    })();

    return () => {
      aborted = true;
      ctrl.abort();
    };
  }, [jobIds]);

  useEffect(() => {
    if (skipCampaignPresetSyncRef.current) {
      skipCampaignPresetSyncRef.current = false;
      return;
    }
    if (!campaignPresetId) {
      setDraftCampaignPreset(null);
      return;
    }
    const preset = campaignPresetRecords.find((p) => p.id === campaignPresetId);
    setDraftCampaignPreset(preset ? { ...preset } : null);
    setPresetSaveError(null);
  }, [campaignPresetId, campaignPresetRecords]);

  useEffect(() => {
    if (skipAdsetPresetSyncRef.current) {
      skipAdsetPresetSyncRef.current = false;
      return;
    }
    if (!adsetPresetId) {
      setDraftAdsetPreset(null);
      setAdvancedTargetingJson('');
      return;
    }
    const preset = adsetPresetRecords.find((p) => p.id === adsetPresetId);
    if (!preset) {
      setDraftAdsetPreset(null);
      setAdvancedTargetingJson('');
      return;
    }
    setDraftAdsetPreset({ ...preset });
    setAdvancedTargetingJson(JSON.stringify(preset.targeting ?? {}, null, 2));
    setPresetSaveError(null);
  }, [adsetPresetId, adsetPresetRecords]);

  const metaCampaignOptions = useMemo(
    () =>
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        objective: c.objective ?? null,
        bidStrategy: c.bidStrategy ?? null,
      })),
    [campaigns],
  );

  const createCampaign = useCallback(async () => {
    if (!campaignPresetId || !draftCampaignPreset) return;

    setCreatingCampaign(true);
    setError(null);
    setPresetSaveError(null);

    try {
      const saved = await persistCampaignPresetDraft(campaignPresetId, draftCampaignPreset);
      if (!saved.ok) {
        setPresetSaveError(saved.error);
        toast.push({ kind: 'error', title: 'Invalid preset', message: saved.error });
        return;
      }

      const data = await json<{ campaign: Campaign }>(
        await fetch('/api/meta/campaigns', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetId: campaignPresetId }),
        }),
      );

      setCampaigns((prev) => [data.campaign, ...prev]);
      setSelectedCampaignId(data.campaign.id);
      setCampaignPresetId('');
      setDraftCampaignPreset(null);
      toast.push({ kind: 'success', title: 'Campaign created', message: data.campaign.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create campaign';
      setError(msg);
      toast.push({ kind: 'error', title: 'Campaign creation failed', message: msg });
    } finally {
      setCreatingCampaign(false);
    }
  }, [campaignPresetId, draftCampaignPreset, toast]);

  const createAdSet = useCallback(async () => {
    if (!adsetPresetId || !selectedCampaignId || !draftAdsetPreset) return;

    setCreatingAdSet(true);
    setError(null);
    setPresetSaveError(null);

    try {
      const saved = await persistAdsetPresetDraft(adsetPresetId, draftAdsetPreset, {
        advancedTargetingJson,
        metaCampaigns: metaCampaignOptions,
      });
      if (!saved.ok) {
        setPresetSaveError(saved.error);
        toast.push({ kind: 'error', title: 'Invalid preset', message: saved.error });
        return;
      }

      const data = await json<{ adSet: AdSet }>(
        await fetch('/api/meta/adsets', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presetId: adsetPresetId, campaignId: selectedCampaignId }),
        }),
      );

      setAdSets((prev) => [data.adSet, ...prev]);
      setSelectedAdSetId(data.adSet.id);
      setAdsetPresetId('');
      setDraftAdsetPreset(null);
      setAdvancedTargetingJson('');
      toast.push({ kind: 'success', title: 'Ad set created', message: data.adSet.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create ad set';
      setError(msg);
      toast.push({ kind: 'error', title: 'Ad set creation failed', message: msg });
    } finally {
      setCreatingAdSet(false);
    }
  }, [adsetPresetId, advancedTargetingJson, draftAdsetPreset, metaCampaignOptions, selectedCampaignId, toast]);

  const copyCreativeFromPrevious = useCallback(
    (groupId: string) => {
      const currentIndex = includedGroups.findIndex((group) => group.groupId === groupId);
      if (currentIndex <= 0) return;
      const source = includedGroups[currentIndex - 1]?.creative;
      if (!source) return;
      updateGroupCreative(groupId, { ...source });
    },
    [includedGroups, updateGroupCreative],
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-4 py-6 sm:px-6">
      <div className="shrink-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Meta Ads
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Post to Meta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build, review, and publish grouped ads from one guided workflow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>

          {step === 'Publish' ? (
            <>
              <button
                type="button"
                onClick={runPublishWorker}
                disabled={loading || workerLoading}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {workerLoading ? 'Processing…' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={loading || workerLoading || includedGroups.length === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Publishing…' : scheduledAt ? 'Schedule ads' : 'Publish now'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canNext}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur-sm sm:-mx-6">
          <Stepper current={step} />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
          <Card
            title={step}
            description={STEP_META[step].description}
            action={
              loading ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Loading…
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {STEP_META[step].icon}
                </div>
              )
            }
          >
            {step === 'Campaign' && (
              <div className="space-y-5">
                {campaigns.length === 0 && !loading ? (
                  <EmptyState
                    icon="folder"
                    title="No campaigns found"
                    description="Create your first campaign from a preset below."
                  />
                ) : (
                  <div className="max-h-[min(420px,45vh)] overflow-y-auto glass-scrollbar pr-1">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {campaigns.map((campaign) => (
                        <OptionCard
                          key={campaign.id}
                          selected={selectedCampaignId === campaign.id}
                          onClick={() => setSelectedCampaignId(campaign.id)}
                          title={campaign.name}
                          subtitle={[campaign.objective, campaign.status].filter(Boolean).join(' · ') || undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <InlinePresetCreate
                  presets={campaignPresets}
                  value={campaignPresetId}
                  onChange={setCampaignPresetId}
                  onCreate={createCampaign}
                  buttonLabel="Create campaign"
                  loading={creatingCampaign}
                />

                {campaignPresetId && draftCampaignPreset ? (
                  <PostPresetFieldsPanel
                    kind="campaign"
                    presetName={draftCampaignPreset.name}
                    draft={draftCampaignPreset}
                    onDraftChange={(next) =>
                      setDraftCampaignPreset((prev) => {
                        if (!prev) return prev;
                        return typeof next === 'function' ? next(prev) : next;
                      })
                    }
                    saveError={presetSaveError}
                    onSaveError={setPresetSaveError}
                    onSaved={(next) => {
                      setCampaignPresetRecords((prev) =>
                        prev.map((p) => (p.id === next.id ? { ...next } : p)),
                      );
                      toast.push({ kind: 'success', title: 'Preset saved' });
                    }}
                  />
                ) : null}
              </div>
            )}

            {step === 'Ad Set' && (
              <div className="space-y-5">
                {!selectedCampaignId ? (
                  <EmptyState
                    icon="alert"
                    title="No campaign selected"
                    description="Go back and choose a campaign before selecting an ad set."
                  />
                ) : (
                  <>
                    {adSets.length === 0 && !loading ? (
                      <EmptyState
                        icon="folder"
                        title="No ad sets found"
                        description="Create an ad set from a preset below."
                      />
                    ) : (
                      <div className="max-h-[min(420px,45vh)] overflow-y-auto glass-scrollbar pr-1">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {adSets.map((adSet) => (
                            <OptionCard
                              key={adSet.id}
                              selected={selectedAdSetId === adSet.id}
                              onClick={() => setSelectedAdSetId(adSet.id)}
                              title={adSet.name}
                              subtitle={adSet.status ?? undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Per-group ad set override</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Turn this on if different groups should publish to different ad sets.
                          </p>
                        </div>

                        <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                          <input
                            type="checkbox"
                            checked={useAdSetPerGroup}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setUseAdSetPerGroup(enabled);
                              if (!enabled) {
                                setGroups((prev) => prev.map((group) => ({ ...group, adSetId: selectedAdSetId })));
                              }
                            }}
                            className="h-4 w-4 rounded border-input"
                          />
                          Enable
                        </label>
                      </div>

                      {useAdSetPerGroup && groups.length > 0 && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {groups.map((group) => (
                            <div key={group.groupId}>
                              <Label htmlFor={`group-adset-${group.groupId}`}>{group.label}</Label>
                              <Select
                                id={`group-adset-${group.groupId}`}
                                value={group.adSetId || ''}
                                onChange={(e) => updateGroup(group.groupId, { adSetId: e.target.value })}
                              >
                                <option value="">Select ad set…</option>
                                {adSets.map((adSet) => (
                                  <option key={adSet.id} value={adSet.id}>
                                    {adSet.name}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <InlinePresetCreate
                      presets={adsetPresets}
                      value={adsetPresetId}
                      onChange={setAdsetPresetId}
                      onCreate={createAdSet}
                      buttonLabel="Create ad set"
                      loading={creatingAdSet}
                    />

                    {adsetPresetId && draftAdsetPreset ? (
                      <PostPresetFieldsPanel
                        kind="adset"
                        presetName={draftAdsetPreset.name}
                        draft={draftAdsetPreset}
                        onDraftChange={(next) =>
                          setDraftAdsetPreset((prev) => {
                            if (!prev) return prev;
                            return typeof next === 'function' ? next(prev) : next;
                          })
                        }
                        metaCampaigns={metaCampaignOptions}
                        advancedTargetingJson={advancedTargetingJson}
                        onAdvancedTargetingJsonChange={setAdvancedTargetingJson}
                        saveError={presetSaveError}
                        onSaveError={setPresetSaveError}
                        onSaved={(next) => {
                          setAdsetPresetRecords((prev) =>
                            prev.map((p) => (p.id === next.id ? { ...next } : p)),
                          );
                          toast.push({ kind: 'success', title: 'Preset saved' });
                        }}
                      />
                    ) : null}
                  </>
                )}
              </div>
            )}

            {step === 'Media' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-foreground">Upload creatives</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload a new batch here. Once processing finishes, we’ll group them automatically and show them below.
                  </p>
                  <div className="mt-4">
                    <UploadStep
                      companyId={companyId}
                      onError={(m) => setError(m)}
                      onUploaded={({ bulkUploadId }) => {
                        setActiveBulkUploadId(bulkUploadId);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="bulk-upload">Bulk upload session</Label>
                  <Select
                    id="bulk-upload"
                    value={activeBulkUploadId}
                    onChange={(e) => setActiveBulkUploadId(e.target.value)}
                  >
                    <option value="">Select an upload…</option>
                    {bulkUploads.map((upload) => (
                      <option key={upload.id} value={upload.id}>
                        {upload.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {mediaLoading ? (
                  <MediaGroupSkeleton />
                ) : !activeBulkUploadId ? (
                  <EmptyState
                    icon="image"
                    title="No upload selected"
                    description="Pick a bulk upload session to load grouped assets."
                  />
                ) : groups.length === 0 ? (
                  <EmptyState
                    icon="image"
                    title="No groups found"
                    description="This upload does not have any analyzed groups yet."
                  />
                ) : (
                  <div className="space-y-4">
                    {groups.map((group) => {
                      const selected = new Set(group.selectedAssetIds);

                      return (
                        <div key={group.groupId} className="rounded-2xl border border-border bg-background">
                          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                              <p className="text-sm text-muted-foreground">
                                {group.assets.length} asset{group.assets.length !== 1 ? 's' : ''} available
                              </p>
                            </div>

                            <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                              <input
                                type="checkbox"
                                checked={group.included}
                                onChange={(e) => updateGroup(group.groupId, { included: e.target.checked })}
                                className="h-4 w-4 rounded border-input"
                              />
                              Include group
                            </label>
                          </div>

                          <div className="p-4">
                            {!group.included ? (
                              <p className="text-sm text-muted-foreground">This group is excluded from publishing.</p>
                            ) : group.assets.length === 0 ? (
                              <EmptyState
                                icon="image"
                                title="No assets in this group"
                                description="Add assets to this bucket before publishing."
                              />
                            ) : (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {group.assets.map((asset) => {
                                  const isSelected = selected.has(asset.id);

                                  return (
                                    <button
                                      key={asset.id}
                                      type="button"
                                      onClick={() => toggleAsset(group.groupId, asset.id)}
                                      className={cx(
                                        'overflow-hidden rounded-2xl border text-left transition',
                                        isSelected
                                          ? 'border-primary ring-1 ring-primary/20'
                                          : 'border-border hover:border-primary/30',
                                      )}
                                    >
                                      <div className="relative aspect-square overflow-hidden bg-muted">
                                        {asset.thumbnailUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={asset.thumbnailUrl}
                                            alt={asset.title}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                            {asset.assetType}
                                          </div>
                                        )}

                                        {isSelected && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-primary/15">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                                              <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="3"
                                              >
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="space-y-1 p-3">
                              <p className="truncate text-sm font-medium text-foreground" title={asset.title}>
                                {asset.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {asset.assetType}
                                {asset.resolution ? ` · ${asset.resolution}` : ''}
                              </p>
                            </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 'Creative Fields' && (
              <div className="space-y-4">
                {includedGroups.length === 0 ? (
                  <EmptyState
                    icon="alert"
                    title="No included groups"
                    description="Go back to Media and include at least one group."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Use Miss Robusta to analyze videos and fill creative copy per group.
                      </p>
                      <button
                        type="button"
                        disabled={creativeAnalyzing}
                        onClick={() => openCreativeAnalyzeDialog(null)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 disabled:opacity-50"
                      >
                        Analyze groups…
                      </button>
                    </div>
                    {includedGroups.map((group, index) => (
                    <div key={group.groupId} className="rounded-2xl border border-border bg-background">
                      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {group.selectedAssetIds.length} selected asset
                            {group.selectedAssetIds.length !== 1 ? 's' : ''}
                          </p>
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            Fill headline and landing URL below before Create all.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={creativeAnalyzing}
                            onClick={() => openCreativeAnalyzeDialog(group.groupId)}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 disabled:opacity-50"
                          >
                            Analyze
                          </button>
                          <button
                            type="button"
                            onClick={() => copyCreativeFromPrevious(group.groupId)}
                            disabled={index === 0}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Copy from previous
                          </button>
                          <button
                            type="button"
                            disabled={creatingAllGroupId === group.groupId}
                            onClick={() => void createAllAdCreativesForGroup(group.groupId)}
                            className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
                          >
                            {creatingAllGroupId === group.groupId
                              ? 'Creating on Meta…'
                              : 'Create all ad creatives'}
                          </button>
                        </div>
                      </div>

                      <GroupAdCreativesPanel
                        assets={group.assets}
                        selectedAssetIds={group.selectedAssetIds}
                        assetCreatives={group.assetCreatives}
                        savedAdCreatives={savedAdCreatives}
                        loadingAdCreatives={loadingAdCreatives}
                        bulkResults={bulkCreativeResultsByGroup[group.groupId] ?? null}
                        onRefreshLibrary={() => void refreshSavedAdCreatives()}
                        onCreate={(assetId) => void createAdCreativeForAsset(group.groupId, assetId)}
                        onApplySaved={(assetId, creativeDbId) =>
                          applySavedCreativeToAsset(group.groupId, assetId, creativeDbId)
                        }
                      />

                      <div className="grid gap-4 p-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`headline-${group.groupId}`}>Headline</Label>
                          <Input
                            id={`headline-${group.groupId}`}
                            value={group.creative.headline}
                            onChange={(e) => updateGroupCreative(group.groupId, { headline: e.target.value })}
                            placeholder="Enter headline"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`landing-${group.groupId}`}>Landing URL</Label>
                          <Input
                            id={`landing-${group.groupId}`}
                            value={group.creative.landingUrl}
                            onChange={(e) => updateGroupCreative(group.groupId, { landingUrl: e.target.value })}
                            placeholder="https://example.com"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`primary-${group.groupId}`}>Primary text</Label>
                          <Textarea
                            id={`primary-${group.groupId}`}
                            value={group.creative.primaryText}
                            onChange={(e) => updateGroupCreative(group.groupId, { primaryText: e.target.value })}
                            placeholder="Write the main ad copy"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label htmlFor={`description-${group.groupId}`} optional>
                            Description
                          </Label>
                          <Input
                            id={`description-${group.groupId}`}
                            value={group.creative.description}
                            onChange={(e) => updateGroupCreative(group.groupId, { description: e.target.value })}
                            placeholder="Optional supporting description"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`cta-${group.groupId}`}>CTA</Label>
                          <Select
                            id={`cta-${group.groupId}`}
                            value={group.creative.ctaType}
                            onChange={(e) => updateGroupCreative(group.groupId, { ctaType: e.target.value })}
                          >
                            {CTA_OPTIONS.map((cta) => (
                              <option key={cta} value={cta}>
                                {cta}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor={`pixel-${group.groupId}`} optional>
                            Pixel ID
                          </Label>
                          <Input
                            id={`pixel-${group.groupId}`}
                            value={group.creative.pixelId}
                            onChange={(e) => updateGroupCreative(group.groupId, { pixelId: e.target.value })}
                            placeholder="Meta pixel id"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            )}

            {step === 'Preview' && (
              <div className="space-y-4">
                {includedGroups.length === 0 ? (
                  <EmptyState
                    icon="alert"
                    title="No included groups"
                    description="Go back and include at least one group."
                  />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {includedGroups.map((group) => {
                      const assetId = group.selectedAssetIds[0] ?? '';
                      const asset = group.assets.find((item) => item.id === assetId) ?? group.assets[0];
                      if (!asset) return null;

                      const placements = placementsForAsset(asset);

                      return (
                        <div key={group.groupId} className="overflow-hidden rounded-2xl border border-border bg-background">
                          <div className="border-b border-border px-4 py-4">
                            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {asset.assetType}
                              {asset.resolution ? ` · ${asset.resolution}` : ''} · {placements.join(', ')}
                            </p>
                          </div>

                          <div className="bg-muted/40">
                            {asset.assetType === 'VIDEO' && asset.playbackUrl ? (
                              // eslint-disable-next-line jsx-a11y/media-has-caption
                              <video controls className="max-h-[420px] w-full object-contain bg-black" src={asset.playbackUrl} />
                            ) : asset.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={asset.thumbnailUrl}
                                alt={asset.title}
                                className="max-h-[420px] w-full object-contain bg-black"
                              />
                            ) : (
                              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                                No preview available
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 border-t border-border px-4 py-4">
                            <p className="text-sm font-semibold text-foreground">{group.creative.headline || '—'}</p>
                            <p className="text-sm text-muted-foreground">{group.creative.primaryText || '—'}</p>
                            <p className="text-xs text-muted-foreground">{group.creative.landingUrl || '—'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 'Publish' && (
              <div className="space-y-5">
                {workerError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 whitespace-pre-wrap">
                    {workerError}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Campaign</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedCampaign?.name ?? '—'}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Ad Set</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedAdSet?.name ?? '—'}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Included groups</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{includedGroups.length}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div>
                    <Label htmlFor="scheduleAt" optional>
                      Schedule
                    </Label>
                    <Input
                      id="scheduleAt"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={runPublishWorker}
                    disabled={loading || workerLoading}
                    className="inline-flex h-10 items-center justify-center self-end rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {workerLoading ? 'Processing…' : 'Refresh'}
                  </button>

                  <button
                    type="button"
                    onClick={publish}
                    disabled={loading || workerLoading || includedGroups.length === 0}
                    className="inline-flex h-10 items-center justify-center self-end rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? 'Publishing…' : scheduledAt ? 'Schedule ads' : 'Publish now'}
                  </button>
                </div>

                {jobIds.length > 0 && (
                  <Card
                    title="Job tracker"
                    description="Live publish status for the jobs created in this session."
                    action={<StatusPill className="border-border bg-muted text-foreground">{jobIds.length} jobs</StatusPill>}
                  >
                    {jobRows.length > 0 ? (
                      <div className="space-y-2">
                        {jobRows.map((job) => (
                          <div
                            key={job.id}
                            className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs text-muted-foreground">{job.id}</p>
                              {job.lastError && (
                                <p className="mt-1 truncate text-xs text-red-600 dark:text-red-400" title={job.lastError}>
                                  {job.lastError}
                                </p>
                              )}
                            </div>

                            <StatusPill className={jobStatusStyle(job.status)}>{job.status}</StatusPill>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Waiting for job updates…
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Step {stepIndex + 1} of {STEPS.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {validationMessage ?? 'Everything required for this step is complete.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={prev}
                disabled={stepIndex === 0}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {step !== 'Publish' ? (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canNext}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={publish}
                  disabled={loading || includedGroups.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scheduledAt ? 'Schedule' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card title="Selection summary" description="Current choices across the workflow.">
            <div className="divide-y divide-border">
              <SummaryRow label="Campaign" value={selectedCampaign?.name ?? 'Not selected'} />
              <SummaryRow label="Ad set" value={selectedAdSet?.name ?? 'Not selected'} />
              <SummaryRow label="Upload" value={activeBulkUpload?.name ?? 'Not selected'} />
              <SummaryRow label="Detected groups" value={buckets.length} />
              <SummaryRow label="Included groups" value={includedGroups.length} />
              <SummaryRow label="Selected assets" value={totalSelectedAssets} />
              <SummaryRow label="Schedule" value={scheduledAt || 'Publish immediately'} />
            </div>
          </Card>

          <Card title="Readiness" description="Quick validation before you continue or publish.">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm text-foreground">Campaign selected</span>
                <StatusPill className={selectedCampaignId ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'}>
                  {selectedCampaignId ? 'Ready' : 'Pending'}
                </StatusPill>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm text-foreground">Ad set selected</span>
                <StatusPill className={selectedAdSetId ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted text-muted-foreground'}>
                  {selectedAdSetId ? 'Ready' : 'Pending'}
                </StatusPill>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm text-foreground">Media selected</span>
                <StatusPill
                  className={
                    activeBulkUploadId && includedGroups.length > 0 && includedGroups.every((group) => group.selectedAssetIds.length > 0)
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border bg-muted text-muted-foreground'
                  }
                >
                  {activeBulkUploadId && includedGroups.length > 0 && includedGroups.every((group) => group.selectedAssetIds.length > 0)
                    ? 'Ready'
                    : 'Pending'}
                </StatusPill>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm text-foreground">Creative completed</span>
                <StatusPill
                  className={
                    includedGroups.length > 0 &&
                    includedGroups.every((group) => group.creative.headline.trim() && group.creative.landingUrl.trim())
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-border bg-muted text-muted-foreground'
                  }
                >
                  {includedGroups.length > 0 &&
                  includedGroups.every((group) => group.creative.headline.trim() && group.creative.landingUrl.trim())
                    ? 'Ready'
                    : 'Pending'}
                </StatusPill>
              </div>
            </div>
          </Card>
        </aside>
        </div>
      </div>

      <CreativeGroupAnalyzeDialog
        open={creativeAnalyzeDialogOpen}
        seedGroupId={creativeAnalyzeSeedGroupId}
        groups={includedGroups.map((g) => ({
          groupId: g.groupId,
          label: g.label,
          selectedAssetCount: g.selectedAssetIds.length,
          assets: g.assets,
          selectedAssetIds: g.selectedAssetIds,
        }))}
        analyzing={creativeAnalyzing}
        onClose={() => {
          if (!creativeAnalyzing) setCreativeAnalyzeDialogOpen(false);
        }}
        onConfirm={(groupIds) => void runCreativeAnalyzeForGroups(groupIds)}
      />

      <MissRobustaPanel
        mode={missRobustaMode}
        subtitle={
          missRobustaMode === 'creative'
            ? 'Video creative copy assistant'
            : 'Campaign & ad set preset assistant'
        }
        activePresetTab={step === 'Ad Set' ? 'adset' : 'campaign'}
        presetDisabled={step !== 'Campaign' && step !== 'Ad Set'}
        creativeDisabled={step !== 'Creative Fields'}
        adType={robustaAdType}
        tone={robustaTone}
        onAdTypeChange={setRobustaAdType}
        onToneChange={setRobustaTone}
        draftCampaign={draftCampaignPreset}
        draftAdset={draftAdsetPreset}
        onApplyCampaign={(next) => {
          skipCampaignPresetSyncRef.current = true;
          setDraftCampaignPreset({ ...next });
          if (!campaignPresetId) {
            const pick =
              campaignPresetRecords.find((p) => p.isDefault) ?? campaignPresetRecords[0];
            if (pick) setCampaignPresetId(pick.id);
          }
        }}
        onApplyAdset={(next) => {
          skipAdsetPresetSyncRef.current = true;
          setDraftAdsetPreset({ ...next });
          setAdvancedTargetingJson(JSON.stringify(next.targeting ?? {}, null, 2));
          if (!adsetPresetId) {
            const pick = adsetPresetRecords.find((p) => p.isDefault) ?? adsetPresetRecords[0];
            if (pick) setAdsetPresetId(pick.id);
          }
        }}
        onAdvancedTargetingSync={setAdvancedTargetingJson}
        showDefaultPresetWarning={
          Boolean(draftCampaignPreset?.isDefault) || Boolean(draftAdsetPreset?.isDefault)
        }
        creativeAssetId={creativeAssistantAssetId}
        creativeGroupLabel={creativeAssistantGroup?.label}
        currentCreative={creativeAssistantGroup?.creative}
        onApplyCreative={(patch) => {
          const groupId = creativeAssistantGroup?.groupId;
          if (groupId) updateGroupCreative(groupId, patch);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────── helpers ── */
function parseResolution(resolution?: string | null): { width: number; height: number } | null {
  if (!resolution) return null;
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(resolution.trim());
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function aspectRatioKey(width: number, height: number): string {
  const targets: Array<{ key: string; ratio: number }> = [
    { key: '1:1', ratio: 1 },
    { key: '4:5', ratio: 4 / 5 },
    { key: '9:16', ratio: 9 / 16 },
    { key: '16:9', ratio: 16 / 9 },
    { key: '4:3', ratio: 4 / 3 },
    { key: '3:4', ratio: 3 / 4 },
  ];

  const ratio = width / height;
  let best = 'OTHER';
  let bestDiff = Infinity;

  for (const target of targets) {
    const diff = Math.abs(ratio - target.ratio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = target.key;
    }
  }

  return bestDiff <= 0.04 ? best : 'OTHER';
}

function placementsForAsset(asset: { resolution?: string | null }): string[] {
  const size = parseResolution(asset.resolution ?? null);
  if (!size) return ['Feed (auto)'];

  const key = aspectRatioKey(size.width, size.height);
  if (key === '9:16') return ['Stories', 'Reels'];
  if (key === '4:3' || key === '16:9') return ['Feed (Facebook)', 'Feed (Instagram)'];
  if (key === '4:5' || key === '3:4') return ['Feed (Instagram)', 'Feed (Facebook)'];
  if (key === '1:1') return ['Feed (Facebook)', 'Feed (Instagram)'];
  return ['Feed (auto)'];
}