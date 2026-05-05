'use client';

import { useMemo, useState } from 'react';

type RuleType =
  | 'AUTO_PAUSE'
  | 'FATIGUE_ALERT'
  | 'BUDGET_PACING'
  | 'SPEND_CONCENTRATION'
  | 'WINNER_AMPLIFICATION';

export type AutomationRule = {
  id: string;
  ruleType: RuleType;
  isEnabled: boolean;
  threshold: number | null;
  window: number | null;
  requiresApproval: boolean;
};

function ruleLabel(ruleType: RuleType) {
  switch (ruleType) {
    case 'AUTO_PAUSE':
      return 'Auto-pause underperformer';
    case 'FATIGUE_ALERT':
      return 'Creative fatigue alert';
    case 'BUDGET_PACING':
      return 'Budget pacing alert';
    case 'SPEND_CONCENTRATION':
      return 'Spend concentration warning';
    case 'WINNER_AMPLIFICATION':
      return 'Winner amplification';
  }
}

function ruleHelp(ruleType: RuleType) {
  switch (ruleType) {
    case 'AUTO_PAUSE':
      return 'Pauses ads when CPI is above your ceiling.';
    case 'FATIGUE_ALERT':
      return 'Flags creatives when CTR drops significantly.';
    case 'BUDGET_PACING':
      return 'Warns when spend is too fast early in the day.';
    case 'SPEND_CONCENTRATION':
      return 'Warns when one creative takes too much budget.';
    case 'WINNER_AMPLIFICATION':
      return 'Suggests scaling winners (manual approval required).';
  }
}

export default function AutomationControls({
  rules,
  onUpdateRule,
}: {
  rules: AutomationRule[];
  onUpdateRule: (ruleType: RuleType, patch: { isEnabled?: boolean; threshold?: number | null }) => void;
}) {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(() => {
    const order: RuleType[] = [
      'AUTO_PAUSE',
      'FATIGUE_ALERT',
      'BUDGET_PACING',
      'SPEND_CONCENTRATION',
      'WINNER_AMPLIFICATION',
    ];
    const byType = new Map(rules.map((r) => [r.ruleType, r]));
    return order.map((t) => byType.get(t)).filter(Boolean) as AutomationRule[];
  }, [rules]);

  return (
    <div className="glass-card p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className="text-lg font-semibold">Automation</h3>
          <p className="text-sm text-muted-foreground">Toggle rules and set thresholds.</p>
        </div>
        <span className="text-sm text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          {sorted.map((r) => (
            <div
              key={r.ruleType}
              className="rounded-2xl border border-border/60 bg-background/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{ruleLabel(r.ruleType)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{ruleHelp(r.ruleType)}</div>
                  {r.requiresApproval ? (
                    <div className="mt-2 text-xs font-semibold text-muted-foreground">
                      Manual approval required
                    </div>
                  ) : null}
                </div>

                <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Off</span>
                  <input
                    type="checkbox"
                    checked={r.isEnabled}
                    onChange={(e) => onUpdateRule(r.ruleType, { isEnabled: e.target.checked })}
                  />
                  <span>On</span>
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Threshold</div>
                  <input
                    className="glass-input mt-1 w-full px-3 py-2 text-sm"
                    type="number"
                    step="0.01"
                    value={r.threshold ?? ''}
                    placeholder="—"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      onUpdateRule(r.ruleType, { threshold: v === '' ? null : Number(v) });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {!sorted.length ? (
            <div className="text-sm text-muted-foreground">
              No rules yet. Click refresh to seed defaults.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

