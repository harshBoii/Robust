'use client';

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

const textareaClass =
  'glass-input w-full resize-y rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground';

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">{label}</span>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">{label}</span>
      <textarea
        className={textareaClass}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <span className="mb-1.5 block font-ui text-[10px] font-medium text-muted-foreground">{label}</span>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
