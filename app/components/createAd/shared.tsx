'use client';

import { useState } from 'react';

import { readApiJson } from '@/lib/api/read-json';

import type { Preset } from './types';

export async function json<T>(res: Response): Promise<T> {
  return readApiJson<T>(res);
}

export function SelectCard({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative rounded-2xl border p-4 text-left transition-all duration-200',
        selected
          ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/30'
          : 'border-border/50 bg-background/30 hover:border-border hover:bg-[var(--glass-hover)]',
      ].join(' ')}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
      <p className="pr-6 text-sm font-medium text-foreground leading-snug">{title}</p>
      {sub && <p className="mt-1 font-ui text-[11px] text-muted-foreground">{sub}</p>}
    </button>
  );
}

export function CreateFromPreset({
  presets,
  selectId,
  label,
  onCreate,
}: {
  presets: Preset[];
  selectId: string;
  label: string;
  onCreate: (presetId: string) => Promise<void>;
}) {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl border border-border/40 bg-background/20 p-4">
      <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Create from preset
      </p>
      {presets.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No presets available.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            id={selectId}
            className="glass-input flex-1 px-3 py-2 text-sm"
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
          >
            <option value="">Select a preset…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedPresetId || busy}
            onClick={async () => {
              if (!selectedPresetId) return;
              setBusy(true);
              try { await onCreate(selectedPresetId); } finally { setBusy(false); }
            }}
            className="glass-button-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating…' : label}
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs">{message}</p>
    </div>
  );
}

export const CREATE_AD_STEPS = ['Upload', 'Groups', 'Campaign', 'Ad Sets', 'Creatives', 'Preview', 'Publish'] as const;
export type CreateAdStep = (typeof CREATE_AD_STEPS)[number];

export function StepBar({ steps, current }: { steps: readonly CreateAdStep[]; current: CreateAdStep }) {
  const currentIdx = steps.indexOf(current);
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-0">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = s === current;
          const isLast = i === steps.length - 1;
          return (
            <li key={s} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 text-xs font-semibold',
                    done
                      ? 'bg-primary text-white shadow-sm'
                      : active
                        ? 'bg-primary/15 text-primary ring-2 ring-primary/40'
                        : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={[
                    'hidden whitespace-nowrap font-ui text-[10px] font-semibold uppercase tracking-widest sm:block',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {s}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    'mx-2 mb-4 h-px flex-1 transition-all duration-500',
                    i < currentIdx ? 'bg-primary/50' : 'bg-border/50',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

