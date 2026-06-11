'use client';

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = value?.startsWith('#') ? value : '#000000';

  return (
    <div>
      <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
          aria-label={`${label} color picker`}
        />
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
