'use client';

import { SCHEDULE_DURATION_OPTIONS, type ScheduleDuration } from '@/lib/meta/adset-schedule';
import {
  ADVANTAGE_AUDIENCE_OPTIONS,
  AUDIENCE_NETWORK_POSITION_OPTIONS,
  FACEBOOK_POSITION_OPTIONS,
  getAdvantageAudienceFromTargeting,
  getTargetingExcludedAudiencesForEditor,
  getTargetingInterestsForEditor,
  INSTAGRAM_POSITION_OPTIONS,
  MESSENGER_POSITION_OPTIONS,
  type AdvantageAudienceFlag,
  withAdvantageAudience,
} from '@/lib/meta/targeting';
import {
  applyValueMinRoasOptionA,
  floorToRoasMultiple,
  getRoasAverageFloor,
  isValueMinRoasBid,
  roasMultipleToFloor,
  withRoasAverageFloor,
} from '@/lib/meta/bid-constraints';
import {
  BILLING_EVENT_OPTIONS,
  CUSTOM_EVENT_TYPE_OPTIONS,
  DEFAULT_BILLING_EVENT,
  DEFAULT_OPTIMIZATION_GOAL,
  OPTIMIZATION_GOAL_OPTIONS,
  billingEventsForCampaign,
  optimizationGoalRequiresPixel,
  optimizationGoalsForCampaign,
} from '@/lib/meta/adset-preset-meta';
import { parseJsonArray } from './payload';
import {
  asIsoLocalInput,
  CheckboxGroup,
  CountryPicker,
  FieldLabel,
  JsonTextarea,
  PRESET_INPUT_CLASS,
  PRESET_TEXTAREA_CLASS,
  SectionBox,
  toIsoFromLocalInput,
} from './preset-form-ui';
import type { AdsetPreset, AnyObj, MetaCampaignOption } from './types';

const BID_STRATEGY_OPTIONS = [
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'COST_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
] as const;
const DESTINATION_TYPE_OPTIONS = [
  'WEBSITE',
  'APP',
  'MESSENGER',
  'WHATSAPP',
  'ON_AD',
  'INSTAGRAM_PROFILE',
] as const;
const ATTRIBUTION_EVENT_TYPE_OPTIONS = ['CLICK_THROUGH', 'VIEW_THROUGH'] as const;
const DEVICE_PLATFORM_OPTIONS = ['mobile', 'desktop'] as const;
const PUBLISHER_PLATFORM_OPTIONS = ['facebook', 'instagram', 'messenger', 'audience_network'] as const;

export function AdsetPresetEditor({
  value,
  onChange,
  metaCampaigns,
  advancedTargetingJson,
  onAdvancedTargetingJsonChange,
  showIdentityExtras = true,
}: {
  value: AdsetPreset;
  onChange: (next: AdsetPreset | ((prev: AdsetPreset) => AdsetPreset)) => void;
  metaCampaigns: MetaCampaignOption[];
  advancedTargetingJson: string;
  onAdvancedTargetingJsonChange: (raw: string) => void;
  showIdentityExtras?: boolean;
}) {
  const setTargeting = (updater: (prev: AnyObj) => AnyObj) => {
    onChange((p) => {
      const prev = p.targeting && typeof p.targeting === 'object' ? (p.targeting as AnyObj) : {};
      return { ...p, targeting: updater(prev) };
    });
  };

  const tgt = (value.targeting ?? {}) as AnyObj;
  const promoted = (value.promotedObject ?? {}) as AnyObj;
  const pinnedMetaCampaign = metaCampaigns.find((c) => c.id === value.pinnedCampaignId);
  const adsetCampaignObjective =
    value.pinnedCampaign?.objective ?? pinnedMetaCampaign?.objective ?? 'OUTCOME_SALES';
  const billingOptions = billingEventsForCampaign(adsetCampaignObjective);
  const optimizationOptions = optimizationGoalsForCampaign(adsetCampaignObjective);
  const needsPixel = optimizationGoalRequiresPixel(value.optimizationGoal);
  const valueMinRoas = isValueMinRoasBid(value.bidStrategy, value.optimizationGoal);
  const roasFloor = getRoasAverageFloor(value.bidConstraints);
  const roasMultipleDisplay = roasFloor != null ? String(floorToRoasMultiple(roasFloor)) : '1';
  const campaignUsesMinRoas = pinnedMetaCampaign?.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS';

  const geo =
    tgt.geo_locations && typeof tgt.geo_locations === 'object'
      ? (tgt.geo_locations as AnyObj)
      : {};
  const flexibleInterests = getTargetingInterestsForEditor(tgt);
  const excludedAudiences = getTargetingExcludedAudiencesForEditor(tgt);
  const countries = Array.isArray(geo.countries)
    ? ((geo.countries as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const devicePlatforms = Array.isArray(tgt.device_platforms)
    ? ((tgt.device_platforms as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const publisherPlatforms = Array.isArray(tgt.publisher_platforms)
    ? ((tgt.publisher_platforms as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const fbPositions = Array.isArray(tgt.facebook_positions)
    ? ((tgt.facebook_positions as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const igPositions = Array.isArray(tgt.instagram_positions)
    ? ((tgt.instagram_positions as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const anPositions = Array.isArray(tgt.audience_network_positions)
    ? ((tgt.audience_network_positions as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const messengerPositions = Array.isArray(tgt.messenger_positions)
    ? ((tgt.messenger_positions as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const advantageAudience = getAdvantageAudienceFromTargeting(tgt);

  return (
    <>
      <SectionBox title="Identity">
        <div className="grid gap-4 md:grid-cols-2">
          <div className={showIdentityExtras ? undefined : 'md:col-span-2'}>
            <FieldLabel>Name</FieldLabel>
            <input
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              placeholder="e.g. Mobile — IN — Purchase"
              value={value.name}
              onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          {showIdentityExtras ? (
            <div>
              <FieldLabel>Pin to campaign</FieldLabel>
              <select
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={value.pinnedCampaignId ?? ''}
                onChange={(e) => onChange((p) => ({ ...p, pinnedCampaignId: e.target.value || null }))}
              >
                <option value="">Not pinned</option>
                {metaCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        {showIdentityExtras ? (
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {(
              [
                ['isDefault', 'Set as default'],
                ['isDefaultCreative', 'Dynamic creative'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer select-none items-center gap-2.5">
                <span
                  className={[
                    'flex h-4 w-4 items-center justify-center rounded border transition',
                    value[key] ? 'border-primary bg-primary' : 'border-border',
                  ].join(' ')}
                >
                  {value[key] && (
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
                  checked={value[key]}
                  onChange={(e) => onChange((p) => ({ ...p, [key]: e.target.checked }))}
                />
                <span className="text-sm text-muted-foreground">{label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </SectionBox>

      <SectionBox title="Budget & Schedule">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>
              Daily budget{' '}
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                int64 smallest unit
              </span>
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
              <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                requires end_time
              </span>
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
          <div className="md:col-span-2">
            <FieldLabel>Duration</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.scheduleDuration ?? ''}
              onChange={(e) => {
                const next = (e.target.value || null) as ScheduleDuration | null;
                onChange((p) => ({
                  ...p,
                  scheduleDuration: next,
                  scheduleCustomEnd: next === 'custom' ? p.scheduleCustomEnd : null,
                }));
              }}
            >
              <option value="">— not set —</option>
              {SCHEDULE_DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              When you create an ad set, the schedule starts immediately and runs for this duration.
            </p>
          </div>
          {value.scheduleDuration === 'custom' ? (
            <div className="md:col-span-2">
              <FieldLabel>Custom end date</FieldLabel>
              <input
                type="datetime-local"
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={asIsoLocalInput(value.scheduleCustomEnd)}
                onChange={(e) =>
                  onChange((p) => ({
                    ...p,
                    scheduleCustomEnd: toIsoFromLocalInput(e.target.value),
                  }))
                }
              />
            </div>
          ) : null}
        </div>
      </SectionBox>

      <SectionBox title="Billing & Optimization">
        <p className="text-xs text-muted-foreground">
          OUTCOME_SALES: billing_event IMPRESSIONS + optimization_goal OFFSITE_CONVERSIONS (with pixel), or
          VALUE + LOWEST_COST_WITH_MIN_ROAS with{' '}
          <span className="font-mono">bid_constraints.roas_average_floor</span> (Meta: 10,000 = 1.0× ROAS).
        </p>
        {campaignUsesMinRoas && !valueMinRoas ? (
          <button
            type="button"
            className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/10"
            onClick={() => onChange((p) => applyValueMinRoasOptionA(p))}
          >
            Match pinned campaign — apply Min ROAS + VALUE (Option A)
          </button>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel sub="required">billing_event</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.billingEvent ?? DEFAULT_BILLING_EVENT}
              onChange={(e) => onChange((p) => ({ ...p, billingEvent: e.target.value }))}
            >
              {BILLING_EVENT_OPTIONS.filter((o) => billingOptions.includes(o.value)).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {BILLING_EVENT_OPTIONS.find((o) => o.value === value.billingEvent)?.hint}
            </p>
          </div>
          <div>
            <FieldLabel sub="required">optimization_goal</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.optimizationGoal ?? DEFAULT_OPTIMIZATION_GOAL}
              onChange={(e) => {
                const nextGoal = e.target.value;
                onChange((p) => {
                  if (nextGoal === 'VALUE') {
                    return applyValueMinRoasOptionA({ ...p, optimizationGoal: nextGoal });
                  }
                  if (p.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS') {
                    return {
                      ...p,
                      optimizationGoal: nextGoal,
                      bidStrategy: null,
                      bidConstraints: {},
                    };
                  }
                  return { ...p, optimizationGoal: nextGoal };
                });
              }}
            >
              {OPTIMIZATION_GOAL_OPTIONS.filter((o) => optimizationOptions.includes(o.value)).map(
                (o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ),
              )}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {OPTIMIZATION_GOAL_OPTIONS.find((o) => o.value === value.optimizationGoal)?.hint}
            </p>
            {value.optimizationGoal === 'VALUE' ? (
              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                VALUE uses bid_strategy LOWEST_COST_WITH_MIN_ROAS and roas_average_floor (not bid_amount).
              </p>
            ) : null}
          </div>
          <div>
            <FieldLabel>bid_strategy</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.bidStrategy ?? ''}
              onChange={(e) => {
                const nextStrategy = e.target.value || null;
                onChange((p) => {
                  if (nextStrategy === 'LOWEST_COST_WITH_MIN_ROAS') {
                    return applyValueMinRoasOptionA({ ...p, bidStrategy: nextStrategy });
                  }
                  if (p.optimizationGoal === 'VALUE') {
                    return {
                      ...p,
                      bidStrategy: nextStrategy,
                      optimizationGoal: DEFAULT_OPTIMIZATION_GOAL,
                      bidConstraints: {},
                    };
                  }
                  return { ...p, bidStrategy: nextStrategy, bidAmount: null };
                });
              }}
            >
              <option value="">— not set —</option>
              {BID_STRATEGY_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          {valueMinRoas ? (
            <div>
              <FieldLabel sub="bid_constraints">
                roas_average_floor{' '}
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                  minimum ROAS (×)
                </span>
              </FieldLabel>
              <input
                type="number"
                min={0.01}
                max={1000}
                step={0.01}
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={roasMultipleDisplay}
                onChange={(e) => {
                  const multiple = Number(e.target.value);
                  if (!Number.isFinite(multiple) || multiple <= 0) return;
                  onChange((p) => ({
                    ...p,
                    bidAmount: null,
                    bidConstraints: withRoasAverageFloor(
                      p.bidConstraints,
                      roasMultipleToFloor(multiple),
                    ),
                  }));
                }}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sent to Meta as{' '}
                <span className="font-mono">
                  {roasFloor ?? roasMultipleToFloor(Number(roasMultipleDisplay) || 1)}
                </span>{' '}
                (1.0× → 10000, 2.0× → 20000).
              </p>
            </div>
          ) : (
            <div>
              <FieldLabel>
                bid_amount{' '}
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                  LOWEST_COST_WITH_BID_CAP only
                </span>
              </FieldLabel>
              <input
                type="number"
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={value.bidAmount ?? ''}
                disabled={value.bidStrategy !== 'LOWEST_COST_WITH_BID_CAP'}
                onChange={(e) => onChange((p) => ({ ...p, bidAmount: e.target.value || null }))}
              />
            </div>
          )}
          <div>
            <FieldLabel>destination_type</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.destinationType ?? ''}
              onChange={(e) => onChange((p) => ({ ...p, destinationType: e.target.value || null }))}
            >
              <option value="">— not set —</option>
              {DESTINATION_TYPE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel sub="sent as array to Meta">pacing_type</FieldLabel>
            <select
              className={`${PRESET_INPUT_CLASS} mt-1.5`}
              value={value.pacingType ?? 'standard'}
              onChange={(e) => onChange((p) => ({ ...p, pacingType: e.target.value }))}
            >
              <option value="standard">standard</option>
              <option value="day_parting">day_parting</option>
            </select>
          </div>
        </div>
      </SectionBox>

      <SectionBox title="Conversion Tracking">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-4">
            <FieldLabel sub={needsPixel ? 'required for conversions' : undefined}>promoted_object</FieldLabel>
            <input
              className={PRESET_INPUT_CLASS}
              placeholder="pixel_id"
              value={String(promoted.pixel_id ?? '')}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  promotedObject: { ...(p.promotedObject ?? {}), pixel_id: e.target.value },
                }))
              }
            />
            <select
              className={PRESET_INPUT_CLASS}
              value={String(promoted.custom_event_type ?? 'PURCHASE')}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  promotedObject: { ...(p.promotedObject ?? {}), custom_event_type: e.target.value },
                }))
              }
            >
              {CUSTOM_EVENT_TYPE_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-muted/10 p-4">
            <FieldLabel>attribution_spec</FieldLabel>
            <p className="text-[10px] text-muted-foreground">
              Allowed event_type: {ATTRIBUTION_EVENT_TYPE_OPTIONS.join(', ')}
            </p>
            <textarea
              rows={5}
              className={`${PRESET_TEXTAREA_CLASS} font-mono text-xs`}
              value={JSON.stringify(value.attributionSpec ?? [], null, 2)}
              onChange={(e) => {
                try {
                  onChange((p) => ({ ...p, attributionSpec: JSON.parse(e.target.value) as unknown[] }));
                } catch {
                  /* keep typing */
                }
              }}
            />
          </div>
        </div>
      </SectionBox>

      <details className="group overflow-hidden rounded-2xl border border-border bg-muted/10">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-muted/20">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Targeting
          </span>
          <svg
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="space-y-5 p-4">
          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <FieldLabel sub="targeting.targeting_automation">Advantage audience</FieldLabel>
            <p className="mt-1 text-xs text-muted-foreground">
              Required by Meta on ad set create. Sets{' '}
              <span className="font-mono">targeting_automation.advantage_audience</span> to{' '}
              <span className="font-mono">1</span> (on) or <span className="font-mono">0</span> (off).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ADVANTAGE_AUDIENCE_OPTIONS.map((opt) => {
                const active = advantageAudience === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setTargeting((t) => withAdvantageAudience(t, opt.value as AdvantageAudienceFlag))
                    }
                    className={[
                      'rounded-xl border px-3 py-2 text-left text-xs transition',
                      active
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className="mt-0.5 block text-[10px] opacity-80">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <FieldLabel>age_min</FieldLabel>
              <input
                type="number"
                min={13}
                max={65}
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={String(tgt.age_min ?? '')}
                onChange={(e) => setTargeting((t) => ({ ...t, age_min: Number(e.target.value) }))}
              />
            </div>
            <div>
              <FieldLabel>age_max</FieldLabel>
              <input
                type="number"
                min={13}
                max={65}
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={String(tgt.age_max ?? '')}
                onChange={(e) => setTargeting((t) => ({ ...t, age_max: Number(e.target.value) }))}
              />
            </div>
            <div>
              <FieldLabel>
                genders{' '}
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                  1=M 2=F
                </span>
              </FieldLabel>
              <input
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={Array.isArray(tgt.genders) ? (tgt.genders as number[]).join(',') : ''}
                onChange={(e) => {
                  const nums = e.target.value
                    .split(',')
                    .map((x) => Number(x.trim()))
                    .filter((n) => n === 1 || n === 2);
                  setTargeting((t) => ({ ...t, genders: nums }));
                }}
              />
            </div>
            <div>
              <FieldLabel>
                locales{' '}
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-60">
                  comma-sep IDs
                </span>
              </FieldLabel>
              <input
                className={`${PRESET_INPUT_CLASS} mt-1.5`}
                value={Array.isArray(tgt.locales) ? (tgt.locales as number[]).join(',') : ''}
                onChange={(e) => {
                  const nums = e.target.value
                    .split(',')
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0);
                  setTargeting((t) => ({ ...t, locales: nums }));
                }}
              />
            </div>
          </div>

          <CountryPicker
            value={countries}
            onChange={(next) =>
              setTargeting((t) => ({
                ...t,
                geo_locations: {
                  ...(typeof t.geo_locations === 'object' && t.geo_locations
                    ? (t.geo_locations as AnyObj)
                    : {}),
                  countries: next,
                },
              }))
            }
          />

          <p className="text-xs text-muted-foreground">
            <span className="font-mono">reels</span> is valid for Instagram only. On Facebook use{' '}
            <span className="font-mono">video_feeds</span>, or omit placement fields for Advantage+.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <CheckboxGroup
              label="device_platforms"
              options={DEVICE_PLATFORM_OPTIONS}
              value={devicePlatforms}
              onChange={(next) => setTargeting((t) => ({ ...t, device_platforms: next }))}
            />
            <CheckboxGroup
              label="publisher_platforms"
              options={PUBLISHER_PLATFORM_OPTIONS}
              value={publisherPlatforms}
              onChange={(next) => setTargeting((t) => ({ ...t, publisher_platforms: next }))}
            />
            <CheckboxGroup
              label="facebook_positions"
              options={FACEBOOK_POSITION_OPTIONS}
              value={fbPositions}
              onChange={(next) => setTargeting((t) => ({ ...t, facebook_positions: next }))}
            />
            <CheckboxGroup
              label="instagram_positions"
              options={INSTAGRAM_POSITION_OPTIONS}
              value={igPositions}
              onChange={(next) => setTargeting((t) => ({ ...t, instagram_positions: next }))}
            />
            <CheckboxGroup
              label="audience_network_positions"
              options={AUDIENCE_NETWORK_POSITION_OPTIONS}
              value={anPositions}
              onChange={(next) => setTargeting((t) => ({ ...t, audience_network_positions: next }))}
            />
            <CheckboxGroup
              label="messenger_positions"
              options={MESSENGER_POSITION_OPTIONS}
              value={messengerPositions}
              onChange={(next) => setTargeting((t) => ({ ...t, messenger_positions: next }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <JsonTextarea
              label="flexible_spec.interests"
              value={flexibleInterests}
              rows={6}
              placeholder={'[\n  { "id": "6003139266461", "name": "Online shopping" }\n]'}
              onChange={(raw) => {
                const parsed = parseJsonArray<{ id: string; name?: string }>(raw);
                if (!parsed) return;
                const interests = parsed
                  .filter((x) => x && typeof x.id === 'string')
                  .map((x) => ({
                    id: x.id,
                    ...(typeof x.name === 'string' ? { name: x.name } : {}),
                  }));
                setTargeting((t) => {
                  const next = { ...t } as AnyObj;
                  delete next.detailed_targeting;
                  if (interests.length) {
                    next.flexible_spec = [{ interests }];
                  } else {
                    delete next.flexible_spec;
                  }
                  return next;
                });
              }}
            />
            <JsonTextarea
              label="custom_audiences"
              value={Array.isArray(tgt.custom_audiences) ? tgt.custom_audiences : []}
              rows={6}
              placeholder={'[\n  { "id": "<AUDIENCE_ID>" }\n]'}
              onChange={(raw) => {
                const parsed = parseJsonArray<{ id: string }>(raw);
                if (!parsed) return;
                setTargeting((t) => ({
                  ...t,
                  custom_audiences: parsed
                    .filter((x) => x && typeof x.id === 'string')
                    .map((x) => ({ id: x.id })),
                }));
              }}
            />
            <JsonTextarea
              label="exclusions.custom_audiences"
              value={excludedAudiences}
              rows={6}
              placeholder={'[\n  { "id": "<AUDIENCE_ID>" }\n]'}
              onChange={(raw) => {
                const parsed = parseJsonArray<{ id: string }>(raw);
                if (!parsed) return;
                const audiences = parsed
                  .filter((x) => x && typeof x.id === 'string')
                  .map((x) => ({ id: x.id }));
                setTargeting((t) => {
                  const next = { ...t } as AnyObj;
                  delete next.excluded_custom_audiences;
                  if (audiences.length) {
                    next.exclusions = { custom_audiences: audiences };
                  } else {
                    delete next.exclusions;
                  }
                  return next;
                });
              }}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 text-amber-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Advanced — full targeting override
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              When non-empty, this JSON completely replaces the structured targeting above on save.
            </p>
            <textarea
              rows={8}
              className={`${PRESET_TEXTAREA_CLASS} font-mono text-xs`}
              value={advancedTargetingJson}
              onChange={(e) => onAdvancedTargetingJsonChange(e.target.value)}
            />
          </div>
        </div>
      </details>
    </>
  );
}
