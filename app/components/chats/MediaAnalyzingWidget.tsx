'use client';

import { useEffect, useState } from 'react';

import type { GroupModel } from '@/app/components/createAd/types';

import { AnalyzingCraftLoader } from './AnalyzingCraftLoader';

const LINES = [
  'Analyzing your craft…',
  'Polishing the touches…',
  'Sorting creatives by vibe…',
];

/** Shows spinner only while analysis is in progress; static done state once groups exist. */
export function MediaAnalyzingWidget({
  groups,
  isActive,
}: {
  groups?: GroupModel[];
  isActive: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!isActive || (groups && groups.length > 0)) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2800);
    return () => clearInterval(t);
  }, [isActive, groups]);

  if (groups && groups.length > 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Grouped into {groups.length} creative group{groups.length === 1 ? '' : 's'}.
      </p>
    );
  }

  if (!isActive) return null;

  return (
    <p className="flex items-center gap-2 text-[13px] italic text-muted-foreground">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60" />
      {LINES[idx]}
    </p>
  );
}
