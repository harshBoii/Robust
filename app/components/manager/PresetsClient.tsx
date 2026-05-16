'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/app/components/UI/ToastProvider';
import { SCHEDULE_DURATION_OPTIONS, type ScheduleDuration } from '@/lib/meta/adset-schedule';
import {
  AUDIENCE_NETWORK_POSITION_OPTIONS,
  FACEBOOK_POSITION_OPTIONS,
  getTargetingExcludedAudiencesForEditor,
  getTargetingInterestsForEditor,
  INSTAGRAM_POSITION_OPTIONS,
  MESSENGER_POSITION_OPTIONS,
  sanitizeMetaTargeting,
} from '@/lib/meta/targeting';
import { AdsetPresetEditor } from '@/app/components/manager/presets/adset-preset-editor';
import {
  BILLING_EVENT_OPTIONS,
  CUSTOM_EVENT_TYPE_OPTIONS,
  DEFAULT_BILLING_EVENT,
  DEFAULT_OPTIMIZATION_GOAL,
  OPTIMIZATION_GOAL_OPTIONS,
  billingEventsForCampaign,
  optimizationGoalRequiresPixel,
  optimizationGoalsForCampaign,
  validateAdsetPresetMeta,
  normalizePromotedObject,
} from '@/lib/meta/adset-preset-meta';

/* ─────────────────────────────────────────── types ── */
type MetaCampaign = { id: string; name: string; objective?: string | null; bidStrategy?: string | null };

type AdsetPreset = {
  id: string; name: string; isDefault: boolean;
  pinnedCampaignId: string | null; pinnedCampaign?: MetaCampaign | null;
  dailyBudget: string | null; lifetimeBudget: string | null;
  scheduleDuration: ScheduleDuration | null;
  scheduleCustomEnd: string | null;
  billingEvent: string | null; optimizationGoal: string | null;
  destinationType: string | null; bidStrategy: string | null; bidAmount: string | null;
  isDefaultCreative: boolean; pacingType: string | null;
  promotedObject: Record<string, unknown> | null;
  attributionSpec: unknown[] | null;
  targeting: Record<string, unknown> | null;
  bidConstraints: Record<string, unknown> | null;
};

type CampaignPreset = {
  id: string; name: string; isDefault: boolean;
  objective: string | null; status: string | null;
  spendCap: string | null; dailyBudget: string | null; lifetimeBudget: string | null;
  bidStrategy: string | null; specialAdCategories: string[] | null;
};

type Tab = 'adset' | 'campaign';
type AnyObj = Record<string, unknown>;

/* ─────────────────────────────────── option constants ── */
const BID_STRATEGY_OPTIONS = ['LOWEST_COST_WITHOUT_CAP','LOWEST_COST_WITH_BID_CAP','COST_CAP','LOWEST_COST_WITH_MIN_ROAS'] as const;
const DESTINATION_TYPE_OPTIONS = ['WEBSITE','APP','MESSENGER','WHATSAPP','ON_AD','INSTAGRAM_PROFILE'] as const;
const ATTRIBUTION_EVENT_TYPE_OPTIONS = ['CLICK_THROUGH','VIEW_THROUGH'] as const;
const COMMON_COUNTRY_CODES = ['IN','US','GB','AU','CA','DE','FR','AE','SG','PH','NG','BR','JP','ID','MY','ZA','PK','BD','SA','EG','KE'] as const;
const DEVICE_PLATFORM_OPTIONS = ['mobile','desktop'] as const;
const PUBLISHER_PLATFORM_OPTIONS = ['facebook','instagram','messenger','audience_network'] as const;
const SPECIAL_AD_CATEGORY_OPTIONS = ['NONE','CREDIT','EMPLOYMENT','HOUSING','ISSUES_ELECTIONS_POLITICS','FINANCIAL_PRODUCTS_SERVICES'] as const;
const CAMPAIGN_OBJECTIVE_OPTIONS = ['OUTCOME_SALES','OUTCOME_LEADS','OUTCOME_TRAFFIC','OUTCOME_ENGAGEMENT','OUTCOME_APP_PROMOTION','OUTCOME_AWARENESS'] as const;
const CAMPAIGN_STATUS_OPTIONS = ['ACTIVE','PAUSED'] as const;

/* ─────────────────────────────────── utility helpers ── */
async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data;
}
function parseCommaList(v: string) { return v.split(',').map((s) => s.trim()).filter(Boolean); }
function uniqStrings(xs: string[]) { return Array.from(new Set(xs)); }
function toggleString(xs: string[], v: string, nextOn?: boolean) {
  const set = new Set(xs);
  const on = nextOn ?? !set.has(v);
  if (on) set.add(v); else set.delete(v);
  return Array.from(set);
}
function parseJsonArray<T>(v: string): T[] | null {
  if (!v.trim()) return [];
  try { const p = JSON.parse(v) as unknown; return Array.isArray(p) ? (p as T[]) : null; } catch { return null; }
}
function asIsoLocalInput(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function toIsoFromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
const get = (o: unknown, k: string) => (o && typeof o === 'object' ? (o as AnyObj)[k] : undefined);

/* ─────────────────────────── small reusable components ── */

function FieldLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <label className="block">
      <span className="font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</span>
      {sub && <span className="ml-1.5 font-ui text-[10px] normal-case tracking-normal text-muted-foreground/60">{sub}</span>}
    </label>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/10 overflow-hidden">
      <div className="border-b border-border/30 px-4 py-3">
        <span className="font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function CheckboxGroup<T extends string>({
  label, options, value, onChange,
}: { label: string; options: readonly T[]; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = value.includes(opt);
          return (
            <label
              key={opt}
              className={[
                'flex cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all duration-150',
                checked
                  ? 'border-primary/40 bg-primary/8 text-foreground'
                  : 'border-border/40 bg-background/20 text-muted-foreground hover:border-border hover:text-foreground',
              ].join(' ')}
            >
              <input type="checkbox" className="sr-only" checked={checked}
                onChange={(e) => onChange(toggleString(value, opt, e.target.checked))} />
              <span className={['flex h-3.5 w-3.5 items-center justify-center rounded border transition-all', checked ? 'border-primary bg-primary' : 'border-current'].join(' ')}>
                {checked && (
                  <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              {opt}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CountryPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <FieldLabel>geo_locations.countries</FieldLabel>
      <input
        className="glass-input mt-1.5 w-full px-3 py-2 text-sm"
        value={value.join(',')}
        onChange={(e) => onChange(uniqStrings(parseCommaList(e.target.value).map((s) => s.toUpperCase())))}
        placeholder="IN,US"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMMON_COUNTRY_CODES.map((code) => {
          const active = value.includes(code);
          return (
            <button key={code} type="button" onClick={() => onChange(toggleString(value, code))}
              className={['rounded-full border px-2.5 py-1 font-ui text-[10px] font-semibold transition-all duration-150',
                active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
              ].join(' ')}
            >
              {code}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JsonTextarea({
  label, value, onChange, placeholder, rows = 6,
}: { label: string; value: unknown; onChange: (raw: string) => void; placeholder?: string; rows?: number }) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    try {
      const canonical = JSON.stringify(JSON.parse(raw));
      const external  = JSON.stringify(value);
      if (canonical !== external) setRaw(JSON.stringify(value, null, 2));
    } catch { /* keep user input */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea rows={rows}
        className={['glass-input mt-1.5 w-full resize-y px-3 py-2 font-mono text-xs', invalid ? 'border-destructive/50' : ''].join(' ')}
        value={raw} placeholder={placeholder}
        onChange={(e) => {
          setRaw(e.target.value);
          try { JSON.parse(e.target.value); setInvalid(false); onChange(e.target.value); } catch { setInvalid(true); }
        }}
      />
      {invalid && <p className="mt-1 font-ui text-[10px] text-destructive">Invalid JSON</p>}
    </div>
  );
}

/* ─────────────────────────────── preset list sidebar ── */
function PresetList<T extends { id: string; name: string }>({
  title, items, selectedId, onSelect, onNew, emptyText, renderSub,
}: {
  title: string; items: T[]; selectedId: string | null;
  onSelect: (id: string) => void; onNew: () => void;
  emptyText: string; renderSub?: (item: T) => string;
}) {
  return (
    <aside className="flex flex-col overflow-hidden rounded-2xl border border-border/50">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <span className="font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        <button type="button" onClick={onNew}
          className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/30 px-2.5 py-1.5 font-ui text-[11px] font-semibold text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <svg className="h-7 w-7 text-muted-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)}
            className={['group w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150',
              selectedId === item.id ? 'border-primary/40 bg-primary/8 shadow-sm' : 'border-transparent hover:border-border/50 hover:bg-[var(--glass-hover)]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <div className={['h-1.5 w-1.5 shrink-0 rounded-full transition-colors', selectedId === item.id ? 'bg-primary' : 'bg-border group-hover:bg-muted-foreground'].join(' ')} />
              <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
            </div>
            {renderSub && <p className="mt-0.5 pl-3.5 font-ui text-[10px] text-muted-foreground truncate">{renderSub(item)}</p>}
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ─────────────────────────────── editor header bar ── */
function EditorHeader({ isNew, onSave, onDelete, loading }: { isNew: boolean; onSave: () => void; onDelete: () => void; loading: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className={['flex h-7 w-7 items-center justify-center rounded-lg', isNew ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'].join(' ')}>
          {isNew ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{isNew ? 'New preset' : 'Edit preset'}</p>
          <p className="font-ui text-[10px] text-muted-foreground">Fields map directly to Meta API payload keys</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isNew && (
          <button type="button" onClick={onDelete} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition-all hover:bg-destructive/8 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
        )}
        <button type="button" onClick={onSave} disabled={loading}
          className="flex items-center gap-1.5 glass-button-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
          )}
          {loading ? 'Saving…' : isNew ? 'Create preset' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════ main component ══ */
export default function PresetsClient() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('adset');
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [adsetPresets, setAdsetPresets] = useState<AdsetPreset[]>([]);
  const [campaignPresets, setCampaignPresets] = useState<CampaignPreset[]>([]);
  const [selectedAdsetPresetId, setSelectedAdsetPresetId] = useState<string | null>(null);
  const [selectedCampaignPresetId, setSelectedCampaignPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAdsetPreset = useMemo(() => adsetPresets.find((p) => p.id === selectedAdsetPresetId) ?? null, [adsetPresets, selectedAdsetPresetId]);
  const selectedCampaignPreset = useMemo(() => campaignPresets.find((p) => p.id === selectedCampaignPresetId) ?? null, [campaignPresets, selectedCampaignPresetId]);

  const blankAdsetPreset = useMemo<AdsetPreset>(() => ({
    id: '', name: '', isDefault: false, pinnedCampaignId: null, pinnedCampaign: null,
    dailyBudget: null, lifetimeBudget: null, scheduleDuration: '1_week', scheduleCustomEnd: null,
    billingEvent: DEFAULT_BILLING_EVENT, optimizationGoal: DEFAULT_OPTIMIZATION_GOAL, destinationType: null,
    bidStrategy: null, bidAmount: null, isDefaultCreative: false, pacingType: 'standard',
    promotedObject: { pixel_id: '', custom_event_type: 'PURCHASE' },
    attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
    targeting: {
      age_min: 25, age_max: 40, genders: [2],
      geo_locations: { countries: ['IN'] },
      device_platforms: ['mobile'],
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'story'],
      instagram_positions: ['stream', 'reels'],
      targeting_automation: { advantage_audience: 1 },
    },
    bidConstraints: {},
  }), []);

  const blankCampaignPreset = useMemo<CampaignPreset>(() => ({
    id: '', name: '', isDefault: false,
    objective: 'OUTCOME_SALES', status: 'PAUSED',
    spendCap: null, dailyBudget: null, lifetimeBudget: null,
    bidStrategy: null, specialAdCategories: [],
  }), []);

  const [draftAdset, setDraftAdset] = useState<AdsetPreset>(blankAdsetPreset);
  const [draftCampaign, setDraftCampaign] = useState<CampaignPreset>(blankCampaignPreset);
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState('');

  const setTargeting = useCallback((updater: (prev: AnyObj) => AnyObj) => {
    setDraftAdset((p) => {
      const prev = (p.targeting && typeof p.targeting === 'object') ? (p.targeting as AnyObj) : {};
      return { ...p, targeting: updater(prev) };
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [adset, camp, meta] = await Promise.all([
        json<{ presets: unknown[] }>(await fetch('/api/presets/adset', { credentials: 'include' })),
        json<{ presets: unknown[] }>(await fetch('/api/presets/campaign', { credentials: 'include' })),
        json<{ campaigns: MetaCampaign[] }>(await fetch('/api/meta/campaigns', { credentials: 'include' })),
      ]);
      const normBigint = (v: unknown): string | null => {
        if (v == null) return null;
        if (typeof v === 'number') return String(Math.floor(v));
        if (typeof v === 'string') return v;
        return String(v);
      };
      setCampaigns((meta.campaigns ?? []).map((c) => ({
        id: String(get(c, 'id') ?? ''),
        name: String(get(c, 'name') ?? ''),
        objective: typeof get(c, 'objective') === 'string' ? (get(c, 'objective') as string) : null,
        bidStrategy: typeof get(c, 'bidStrategy') === 'string' ? (get(c, 'bidStrategy') as string) : null,
      })));
      setAdsetPresets((adset.presets ?? []).map((p) => {
        const pinned = get(p, 'pinnedCampaign');
        return {
          id: String(get(p,'id') ?? ''), name: String(get(p,'name') ?? ''),
          isDefault: Boolean(get(p,'isDefault')),
          pinnedCampaignId: typeof get(p,'pinnedCampaignId') === 'string' ? (get(p,'pinnedCampaignId') as string) : null,
          pinnedCampaign: pinned && typeof pinned === 'object' ? {
            id: String(get(pinned,'id') ?? ''),
            name: String(get(pinned,'name') ?? ''),
            objective: typeof get(pinned,'objective') === 'string' ? (get(pinned,'objective') as string) : null,
          } : null,
          billingEvent: typeof get(p,'billingEvent') === 'string' && get(p,'billingEvent')
            ? (get(p,'billingEvent') as string)
            : DEFAULT_BILLING_EVENT,
          optimizationGoal: typeof get(p,'optimizationGoal') === 'string' && get(p,'optimizationGoal')
            ? (get(p,'optimizationGoal') as string)
            : DEFAULT_OPTIMIZATION_GOAL,
          dailyBudget: normBigint(get(p,'dailyBudget')), lifetimeBudget: normBigint(get(p,'lifetimeBudget')),
          scheduleDuration: (() => {
            const d = get(p, 'scheduleDuration');
            if (d === '3_days' || d === '1_week' || d === '1_month' || d === 'custom') return d;
            const legacyEnd = get(p, 'endTime');
            if (typeof legacyEnd === 'string' && legacyEnd) return 'custom' as ScheduleDuration;
            return null;
          })(),
          scheduleCustomEnd: (() => {
            const custom = get(p, 'scheduleCustomEnd');
            if (typeof custom === 'string' && custom) return custom;
            const legacyEnd = get(p, 'endTime');
            if (typeof legacyEnd === 'string' && legacyEnd) return legacyEnd;
            return null;
          })(),
          destinationType: typeof get(p,'destinationType') === 'string' ? (get(p,'destinationType') as string) : null,
          bidStrategy: typeof get(p,'bidStrategy') === 'string' ? (get(p,'bidStrategy') as string) : null,
          bidAmount: normBigint(get(p,'bidAmount')),
          isDefaultCreative: Boolean(get(p,'isDefaultCreative')),
          pacingType: typeof get(p,'pacingType') === 'string' ? (get(p,'pacingType') as string) : null,
          promotedObject: (get(p,'promotedObject') && typeof get(p,'promotedObject') === 'object') ? (get(p,'promotedObject') as AnyObj) : {},
          attributionSpec: Array.isArray(get(p,'attributionSpec')) ? (get(p,'attributionSpec') as unknown[]) : [],
          targeting: (get(p,'targeting') && typeof get(p,'targeting') === 'object') ? (get(p,'targeting') as AnyObj) : {},
          bidConstraints: (get(p,'bidConstraints') && typeof get(p,'bidConstraints') === 'object') ? (get(p,'bidConstraints') as AnyObj) : {},
        } satisfies AdsetPreset;
      }));
      setCampaignPresets((camp.presets ?? []).map((p) => ({
        id: String(get(p,'id') ?? ''), name: String(get(p,'name') ?? ''),
        isDefault: Boolean(get(p,'isDefault')),
        objective: typeof get(p,'objective') === 'string' ? (get(p,'objective') as string) : null,
        status: typeof get(p,'status') === 'string' ? (get(p,'status') as string) : null,
        spendCap: normBigint(get(p,'spendCap')),
        dailyBudget: normBigint(get(p,'dailyBudget')),
        lifetimeBudget: normBigint(get(p,'lifetimeBudget')),
        bidStrategy: typeof get(p,'bidStrategy') === 'string' ? (get(p,'bidStrategy') as string) : null,
        specialAdCategories: Array.isArray(get(p,'specialAdCategories')) ? ((get(p,'specialAdCategories') as unknown[]).filter((x) => typeof x === 'string') as string[]) : [],
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (tab !== 'adset') return;
    setDraftAdset(selectedAdsetPreset ?? blankAdsetPreset);
    setAdvancedTargetingJson(JSON.stringify((selectedAdsetPreset ?? blankAdsetPreset).targeting ?? {}, null, 2));
  }, [tab, selectedAdsetPreset, blankAdsetPreset]);

  useEffect(() => {
    if (tab !== 'campaign') return;
    setDraftCampaign(selectedCampaignPreset ?? blankCampaignPreset);
  }, [tab, selectedCampaignPreset, blankCampaignPreset]);

  const saveAdset = useCallback(async () => {
    if (!draftAdset.name.trim()) { toast.push({ kind: 'error', title: 'Missing name', message: 'Please name this preset.' }); return; }
    if (draftAdset.scheduleDuration === 'custom' && !draftAdset.scheduleCustomEnd) {
      toast.push({ kind: 'error', title: 'Missing end date', message: 'Pick a custom end date for the schedule.' });
      return;
    }
    const pinnedMeta = campaigns.find((c) => c.id === draftAdset.pinnedCampaignId);
    const campaignObjective =
      draftAdset.pinnedCampaign?.objective ?? pinnedMeta?.objective ?? 'OUTCOME_SALES';
    const promotedForValidate = normalizePromotedObject(draftAdset.promotedObject);
    const metaCheck = validateAdsetPresetMeta({
      billingEvent: draftAdset.billingEvent ?? DEFAULT_BILLING_EVENT,
      optimizationGoal: draftAdset.optimizationGoal ?? DEFAULT_OPTIMIZATION_GOAL,
      promotedObject: promotedForValidate,
      bidStrategy: draftAdset.bidStrategy,
      bidAmount: draftAdset.bidAmount,
      bidConstraints: draftAdset.bidConstraints,
      campaignObjective,
    });
    if (!metaCheck.ok) {
      toast.push({ kind: 'error', title: 'Invalid Meta settings', message: metaCheck.error });
      return;
    }
    let targeting: AnyObj = draftAdset.targeting ?? {};
    if (advancedTargetingJson.trim()) {
      try { targeting = JSON.parse(advancedTargetingJson) as AnyObj; }
      catch { toast.push({ kind: 'error', title: 'Invalid JSON', message: 'Fix the Advanced targeting JSON.' }); return; }
    }
    const sanitizedTargeting = sanitizeMetaTargeting(targeting) ?? {
      targeting_automation: { advantage_audience: 1 },
    };
    const payload = {
      name: draftAdset.name, isDefault: draftAdset.isDefault, pinnedCampaignId: draftAdset.pinnedCampaignId,
      dailyBudget: draftAdset.dailyBudget ? Number(draftAdset.dailyBudget) : null,
      lifetimeBudget: draftAdset.lifetimeBudget ? Number(draftAdset.lifetimeBudget) : null,
      scheduleDuration: draftAdset.scheduleDuration,
      scheduleCustomEnd: draftAdset.scheduleCustomEnd,
      billingEvent: draftAdset.billingEvent, optimizationGoal: draftAdset.optimizationGoal,
      destinationType: draftAdset.destinationType, bidStrategy: draftAdset.bidStrategy,
      bidAmount: draftAdset.bidAmount ? Number(draftAdset.bidAmount) : null,
      isDefaultCreative: draftAdset.isDefaultCreative, pacingType: draftAdset.pacingType,
      promotedObject: draftAdset.promotedObject, attributionSpec: draftAdset.attributionSpec,
      targeting: sanitizedTargeting, bidConstraints: draftAdset.bidConstraints ?? {},
    };
    setLoading(true); setError(null);
    try {
      if (!draftAdset.id) {
        await json(await fetch('/api/presets/adset', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
        toast.push({ kind: 'success', title: 'Preset created' });
      } else {
        await json(await fetch(`/api/presets/adset/${draftAdset.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
        toast.push({ kind: 'success', title: 'Preset saved' });
      }
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setError(msg); toast.push({ kind: 'error', title: 'Save failed', message: msg });
    } finally { setLoading(false); }
  }, [draftAdset, advancedTargetingJson, toast, refresh, campaigns]);

  const deleteAdset = useCallback(async () => {
    if (!draftAdset.id) return;
    if (!window.confirm('Delete this ad set preset?')) return;
    setLoading(true);
    try {
      await json(await fetch(`/api/presets/adset/${draftAdset.id}`, { method: 'DELETE', credentials: 'include' }));
      toast.push({ kind: 'success', title: 'Preset deleted' });
      setSelectedAdsetPresetId(null); setDraftAdset(blankAdsetPreset); await refresh();
    } catch (e) { toast.push({ kind: 'error', title: 'Delete failed', message: e instanceof Error ? e.message : 'Delete failed' }); }
    finally { setLoading(false); }
  }, [draftAdset.id, toast, blankAdsetPreset, refresh]);

  const saveCampaign = useCallback(async () => {
    if (!draftCampaign.name.trim()) { toast.push({ kind: 'error', title: 'Missing name', message: 'Please name this preset.' }); return; }
    const payload = {
      name: draftCampaign.name, isDefault: draftCampaign.isDefault,
      objective: draftCampaign.objective, status: draftCampaign.status,
      spendCap: draftCampaign.spendCap ? Number(draftCampaign.spendCap) : null,
      dailyBudget: draftCampaign.dailyBudget ? Number(draftCampaign.dailyBudget) : null,
      lifetimeBudget: draftCampaign.lifetimeBudget ? Number(draftCampaign.lifetimeBudget) : null,
      bidStrategy: draftCampaign.bidStrategy,
      specialAdCategories: draftCampaign.specialAdCategories ?? [],
    };
    setLoading(true); setError(null);
    try {
      if (!draftCampaign.id) {
        await json(await fetch('/api/presets/campaign', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
        toast.push({ kind: 'success', title: 'Preset created' });
      } else {
        await json(await fetch(`/api/presets/campaign/${draftCampaign.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
        toast.push({ kind: 'success', title: 'Preset saved' });
      }
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      setError(msg); toast.push({ kind: 'error', title: 'Save failed', message: msg });
    } finally { setLoading(false); }
  }, [draftCampaign, toast, refresh]);

  const deleteCampaign = useCallback(async () => {
    if (!draftCampaign.id) return;
    if (!window.confirm('Delete this campaign preset?')) return;
    setLoading(true);
    try {
      await json(await fetch(`/api/presets/campaign/${draftCampaign.id}`, { method: 'DELETE', credentials: 'include' }));
      toast.push({ kind: 'success', title: 'Preset deleted' });
      setSelectedCampaignPresetId(null); setDraftCampaign(blankCampaignPreset); await refresh();
    } catch (e) { toast.push({ kind: 'error', title: 'Delete failed', message: e instanceof Error ? e.message : 'Delete failed' }); }
    finally { setLoading(false); }
  }, [draftCampaign.id, toast, blankCampaignPreset, refresh]);

  /* ── derived targeting state ── */
  const tgt = (draftAdset.targeting ?? {}) as AnyObj;
  const promoted = (draftAdset.promotedObject ?? {}) as AnyObj;
  const pinnedMetaCampaign = campaigns.find((c) => c.id === draftAdset.pinnedCampaignId);
  const adsetCampaignObjective =
    draftAdset.pinnedCampaign?.objective ?? pinnedMetaCampaign?.objective ?? 'OUTCOME_SALES';
  const billingOptions = billingEventsForCampaign(adsetCampaignObjective);
  const optimizationOptions = optimizationGoalsForCampaign(adsetCampaignObjective);
  const needsPixel = optimizationGoalRequiresPixel(draftAdset.optimizationGoal);
  const geo = (tgt.geo_locations && typeof tgt.geo_locations === 'object') ? (tgt.geo_locations as AnyObj) : {};
  const flexibleInterests = getTargetingInterestsForEditor(tgt);
  const excludedAudiences = getTargetingExcludedAudiencesForEditor(tgt);
  const countries = Array.isArray(geo.countries) ? (geo.countries as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const devicePlatforms = Array.isArray(tgt.device_platforms) ? (tgt.device_platforms as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const publisherPlatforms = Array.isArray(tgt.publisher_platforms) ? (tgt.publisher_platforms as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const fbPositions = Array.isArray(tgt.facebook_positions) ? (tgt.facebook_positions as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const igPositions = Array.isArray(tgt.instagram_positions) ? (tgt.instagram_positions as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const anPositions = Array.isArray(tgt.audience_network_positions)
    ? (tgt.audience_network_positions as unknown[]).filter((x) => typeof x === 'string') as string[]
    : [];
  const messengerPositions = Array.isArray(tgt.messenger_positions)
    ? (tgt.messenger_positions as unknown[]).filter((x) => typeof x === 'string') as string[]
    : [];

  /* ════════════════════════════════════════════════════ render ══ */
  return (
    <div className="mx-auto max-w-7xl space-y-5">

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </span>
            <span className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">Meta Ads</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Presets</h1>
          <p className="text-sm text-muted-foreground">
            Save reusable Meta ad configurations. Ad Set presets can be pinned to a specific campaign.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}
          className="flex items-center gap-2 glass-button px-4 py-2 text-sm disabled:opacity-50"
        >
          <svg className={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
          </svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-2xl border border-border/40 bg-background/20 p-1 w-fit">
        {(['adset', 'campaign'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={['rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150',
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t === 'adset' ? 'Ad Set Presets' : 'Campaign Presets'}
          </button>
        ))}
      </div>

      {/* Split panel */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">

        {/* Sidebar */}
        {tab === 'adset' ? (
          <PresetList
            title="Ad Set Presets" items={adsetPresets} selectedId={selectedAdsetPresetId}
            onSelect={setSelectedAdsetPresetId}
            onNew={() => { setSelectedAdsetPresetId(null); setDraftAdset(blankAdsetPreset); setAdvancedTargetingJson(JSON.stringify(blankAdsetPreset.targeting ?? {}, null, 2)); }}
            emptyText="No ad set presets yet"
            renderSub={(p) => p.pinnedCampaign?.name ? `📌 ${p.pinnedCampaign.name}` : 'Not pinned'}
          />
        ) : (
          <PresetList
            title="Campaign Presets" items={campaignPresets} selectedId={selectedCampaignPresetId}
            onSelect={setSelectedCampaignPresetId}
            onNew={() => { setSelectedCampaignPresetId(null); setDraftCampaign(blankCampaignPreset); }}
            emptyText="No campaign presets yet"
            renderSub={(p) => [p.objective, p.status].filter(Boolean).join(' · ') || '—'}
          />
        )}

        {/* Editor */}
        <div className="rounded-2xl border border-border/50 bg-background/10 overflow-hidden">
          <div className="border-b border-border/40 px-5 py-4">
            <EditorHeader
              isNew={tab === 'adset' ? !draftAdset.id : !draftCampaign.id}
              onSave={tab === 'adset' ? saveAdset : saveCampaign}
              onDelete={tab === 'adset' ? deleteAdset : deleteCampaign}
              loading={loading}
            />
          </div>

          <div className="overflow-y-auto p-5 space-y-4">

            {/* ══ AD SET EDITOR ══ */}
            {tab === 'adset' && (
              <AdsetPresetEditor
                value={draftAdset}
                onChange={setDraftAdset}
                metaCampaigns={campaigns}
                advancedTargetingJson={advancedTargetingJson}
                onAdvancedTargetingJsonChange={setAdvancedTargetingJson}
              />
            )}

            {/* ══ CAMPAIGN EDITOR ══ */}
            {tab === 'campaign' && (
              <>
                <SectionBox title="Identity">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <input className="glass-input mt-1.5 w-full px-3 py-2 text-sm" placeholder="e.g. Sales — Q3 2025"
                        value={draftCampaign.name} onChange={(e) => setDraftCampaign((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex cursor-pointer items-center gap-2.5 select-none">
                        <span className={['flex h-4 w-4 items-center justify-center rounded border transition-all', draftCampaign.isDefault ? 'border-primary bg-primary' : 'border-border'].join(' ')}>
                          {draftCampaign.isDefault && <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                        <input type="checkbox" className="sr-only" checked={draftCampaign.isDefault}
                          onChange={(e) => setDraftCampaign((p) => ({ ...p, isDefault: e.target.checked }))} />
                        <span className="text-sm text-muted-foreground">Set as default</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>objective</FieldLabel>
                      <select className="glass-input mt-1.5 w-full px-3 py-2 text-sm" value={draftCampaign.objective ?? ''}
                        onChange={(e) => setDraftCampaign((p) => ({ ...p, objective: e.target.value || null }))}>
                        <option value="">— not set —</option>
                        {CAMPAIGN_OBJECTIVE_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>status</FieldLabel>
                      <div className="mt-1.5 flex gap-2">
                        {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                          <button key={s} type="button" onClick={() => setDraftCampaign((p) => ({ ...p, status: s }))}
                            className={['flex-1 rounded-xl border py-2 text-xs font-semibold transition-all',
                              draftCampaign.status === s
                                ? s === 'ACTIVE'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                            ].join(' ')}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionBox>

                <SectionBox title="Budget">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel>Daily budget <span className="text-[10px] normal-case tracking-normal font-normal opacity-60">int64</span></FieldLabel>
                      <input type="number" className="glass-input mt-1.5 w-full px-3 py-2 text-sm" value={draftCampaign.dailyBudget ?? ''}
                        onChange={(e) => setDraftCampaign((p) => ({ ...p, dailyBudget: e.target.value || null, lifetimeBudget: e.target.value ? null : p.lifetimeBudget }))} />
                    </div>
                    <div>
                      <FieldLabel>Lifetime budget <span className="text-[10px] normal-case tracking-normal font-normal opacity-60">int64</span></FieldLabel>
                      <input type="number" className="glass-input mt-1.5 w-full px-3 py-2 text-sm" value={draftCampaign.lifetimeBudget ?? ''}
                        onChange={(e) => setDraftCampaign((p) => ({ ...p, lifetimeBudget: e.target.value || null, dailyBudget: e.target.value ? null : p.dailyBudget }))} />
                    </div>
                    <div>
                      <FieldLabel>spend_cap <span className="text-[10px] normal-case tracking-normal font-normal opacity-60">int64</span></FieldLabel>
                      <input type="number" className="glass-input mt-1.5 w-full px-3 py-2 text-sm" value={draftCampaign.spendCap ?? ''}
                        onChange={(e) => setDraftCampaign((p) => ({ ...p, spendCap: e.target.value || null }))} />
                    </div>
                  </div>
                </SectionBox>

                <SectionBox title="Bidding & Compliance">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>bid_strategy</FieldLabel>
                      <select className="glass-input mt-1.5 w-full px-3 py-2 text-sm" value={draftCampaign.bidStrategy ?? ''}
                        onChange={(e) => setDraftCampaign((p) => ({ ...p, bidStrategy: e.target.value || null }))}>
                        <option value="">— not set —</option>
                        {BID_STRATEGY_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>special_ad_categories</FieldLabel>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {SPECIAL_AD_CATEGORY_OPTIONS.map((opt) => {
                          const curr = (draftCampaign.specialAdCategories ?? []).filter((x) => typeof x === 'string');
                          const checked = curr.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-2 rounded-xl border border-border/40 px-3 py-2 text-sm text-muted-foreground"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked ? uniqStrings([...curr, opt]) : curr.filter((x) => x !== opt);
                                  const normalized = next.includes('NONE') ? (['NONE'] as string[]) : next.filter((x) => x !== 'NONE');
                                  setDraftCampaign((p) => ({ ...p, specialAdCategories: normalized }));
                                }}
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Leave empty for default behavior, or select <span className="font-semibold">NONE</span>.
                      </div>
                    </div>
                  </div>
                </SectionBox>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}