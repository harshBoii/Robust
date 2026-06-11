'use client';

import type { DnaTabId } from '@/lib/brand-dna/types';

const TABS: { id: DnaTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'visual', label: 'Visual DNA' },
  { id: 'communication', label: 'Communication DNA' },
  { id: 'audience', label: 'Audience DNA' },
  { id: 'compliance', label: 'Compliance DNA' },
];

export function DnaChipNav({
  active,
  onChange,
}: {
  active: DnaTabId;
  onChange: (tab: DnaTabId) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
            active === tab.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
