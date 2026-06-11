'use client';

import { AiOutlineLoading } from 'react-icons/ai';

export function DnaSaveBar({
  onSave,
  saving,
  label = 'Save',
}: {
  onSave: () => void;
  saving: boolean;
  label?: string;
}) {
  return (
    <div className="sticky bottom-0 mt-4 border-t border-border bg-card/95 pt-3 backdrop-blur-sm">
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving && <AiOutlineLoading className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
