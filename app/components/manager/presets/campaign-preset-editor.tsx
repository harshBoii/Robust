'use client';

import type { CampaignPreset } from './types';
import { FieldLabel, PRESET_INPUT_CLASS, SectionBox, uniqStrings } from './preset-form-ui';

const BID_STRATEGY_OPTIONS = [
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'COST_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
] as const;

const SPECIAL_AD_CATEGORY_OPTIONS = [
  'NONE',
  'CREDIT',
  'EMPLOYMENT',
  'HOUSING',
  'ISSUES_ELECTIONS_POLITICS',
  'FINANCIAL_PRODUCTS_SERVICES',
] as const;

const CAMPAIGN_OBJECTIVE_OPTIONS = [
  'OUTCOME_SALES',
  'OUTCOME_LEADS',
  'OUTCOME_TRAFFIC',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_APP_PROMOTION',
  'OUTCOME_AWARENESS',
] as const;

const CAMPAIGN_STATUS_OPTIONS = ['ACTIVE', 'PAUSED'] as const;

export function CampaignPresetEditor({
  value,
  onChange,
  showDefaultToggle = true,
}: {
  value: CampaignPreset;
  onChange: (next: CampaignPreset | ((prev: CampaignPreset) => CampaignPreset)) => void;
  showDefaultToggle?: boolean;
}) {
  return (
    <>
      <SectionBox title="Identity">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              placeholder="e.g. Sales — Q3 2025"
              value={value.name}
              onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          {showDefaultToggle && (
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer select-none items-center gap-2.5">
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded border transition-all',
                    value.isDefault ? 'border-primary bg-primary' : 'border-border',
                  ].join(' ')}
                >
                  {value.isDefault && (
                    <svg
                      className="h-2.5 w-2.5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={value.isDefault}
                  onChange={(e) => onChange((p) => ({ ...p, isDefault: e.target.checked }))}
                />
                <span className="text-sm text-muted-foreground">Set as default</span>
              </label>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>objective</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.objective ?? ''}
              onChange={(e) => onChange((p) => ({ ...p, objective: e.target.value || null }))}
            >
              <option value="">— not set —</option>
              {CAMPAIGN_OBJECTIVE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>status</FieldLabel>
            <div className="mt-1.5 flex gap-2">
              {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange((p) => ({ ...p, status: s }))}
                  className={[
                    'flex-1 rounded-xl border py-2 text-xs font-semibold transition-all',
                    value.status === s
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
            <FieldLabel>
              Daily budget{' '}
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">int64</span>
            </FieldLabel>
            <input
              type="number"
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.dailyBudget ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  dailyBudget: e.target.value || null,
                  lifetimeBudget: e.target.value ? null : p.lifetimeBudget,
                }))
              }
            />
          </div>
          <div>
            <FieldLabel>
              Lifetime budget{' '}
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">int64</span>
            </FieldLabel>
            <input
              type="number"
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.lifetimeBudget ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  lifetimeBudget: e.target.value || null,
                  dailyBudget: e.target.value ? null : p.dailyBudget,
                }))
              }
            />
          </div>
          <div>
            <FieldLabel>
              spend_cap{' '}
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">int64</span>
            </FieldLabel>
            <input
              type="number"
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.spendCap ?? ''}
              onChange={(e) => onChange((p) => ({ ...p, spendCap: e.target.value || null }))}
            />
          </div>
        </div>
      </SectionBox>

      <SectionBox title="Bidding & Compliance">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>bid_strategy</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.bidStrategy ?? ''}
              onChange={(e) => onChange((p) => ({ ...p, bidStrategy: e.target.value || null }))}
            >
              <option value="">— not set —</option>
              {BID_STRATEGY_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>special_ad_categories</FieldLabel>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {SPECIAL_AD_CATEGORY_OPTIONS.map((opt) => {
                const curr = (value.specialAdCategories ?? []).filter((x) => typeof x === 'string');
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
                        const next = e.target.checked
                          ? uniqStrings([...curr, opt])
                          : curr.filter((x) => x !== opt);
                        const normalized = next.includes('NONE')
                          ? (['NONE'] as string[])
                          : next.filter((x) => x !== 'NONE');
                        onChange((p) => ({ ...p, specialAdCategories: normalized }));
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
  );
}
