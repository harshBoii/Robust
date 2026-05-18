'use client';

export function SkippedFieldsBanner({
  skippedFields,
  prefix,
}: {
  skippedFields: string[];
  prefix?: string;
}) {
  if (skippedFields.length === 0) return null;

  const label = skippedFields.map((f) => f.replace(/^campaign\.|^adset\./, '')).join(', ');

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
      {prefix ? `${prefix}: ` : ''}
      Some fields could not be validated and were skipped: <strong>{label}</strong>. Apply will fill the
      rest.
    </div>
  );
}
