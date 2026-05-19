'use client';

import { useEffect, useState } from 'react';

const LINES = [
  'Analyzing your craft…',
  'Polishing the touches…',
  'Sorting creatives by vibe…',
  'Finding the perfect groups…',
  'Almost ready to shine…',
];

export function AnalyzingCraftLoader() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <p className="flex items-center gap-2 text-[13px] italic text-muted-foreground">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60" />
      {LINES[idx]}
    </p>
  );
}
