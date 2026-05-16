'use client';

import { useEffect, useState, type ReactNode } from 'react';

export const PRESET_INPUT_CLASS =
  'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary';

export const PRESET_TEXTAREA_CLASS =
  'min-h-[96px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary';

export function FieldLabel({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{children}</span>
      {sub && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{sub}</span>}
    </label>
  );
}

export function SectionBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted/10">
      <div className="border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

export function toggleString(xs: string[], v: string, nextOn?: boolean) {
  const set = new Set(xs);
  const on = nextOn ?? !set.has(v);
  if (on) set.add(v);
  else set.delete(v);
  return Array.from(set);
}

export function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs));
}

export function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
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
                'flex cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-2 text-xs transition',
                checked
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => onChange(toggleString(value, opt, e.target.checked))}
              />
              <span
                className={[
                  'flex h-3.5 w-3.5 items-center justify-center rounded border transition',
                  checked ? 'border-primary bg-primary' : 'border-current',
                ].join(' ')}
              >
                {checked && (
                  <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <polyline points="20 6 9 17 4 12" />
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

const COMMON_COUNTRY_CODES = ['IN', 'US', 'GB', 'AU', 'CA', 'DE', 'FR', 'AE', 'SG', 'PH'] as const;

export function CountryPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div>
      <FieldLabel>geo_locations.countries</FieldLabel>
      <input
        className={`${PRESET_INPUT_CLASS} mt-1.5`}
        value={value.join(',')}
        onChange={(e) =>
          onChange(
            uniqStrings(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => s.toUpperCase()),
            ),
          )
        }
        placeholder="IN,US"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMMON_COUNTRY_CODES.map((code) => {
          const active = value.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => onChange(toggleString(value, code))}
              className={[
                'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
                active
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
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

export function JsonTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  label: string;
  value: unknown;
  onChange: (raw: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    try {
      const canonical = JSON.stringify(JSON.parse(raw));
      const external = JSON.stringify(value);
      if (canonical !== external) setRaw(JSON.stringify(value, null, 2));
    } catch {
      /* keep user input */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        rows={rows}
        className={`${PRESET_TEXTAREA_CLASS} mt-1.5 font-mono text-xs ${invalid ? 'border-destructive/50' : ''}`}
        value={raw}
        placeholder={placeholder}
        onChange={(e) => {
          setRaw(e.target.value);
          try {
            JSON.parse(e.target.value);
            setInvalid(false);
            onChange(e.target.value);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && <p className="mt-1 text-[10px] text-destructive">Invalid JSON</p>}
    </div>
  );
}

export function asIsoLocalInput(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function toIsoFromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
