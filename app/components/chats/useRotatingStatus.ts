'use client';

import { useEffect, useState } from 'react';

export function useRotatingStatus(
  messages: readonly string[],
  active: boolean,
  intervalMs = 2800,
): string | null {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, messages.length, intervalMs]);

  if (!active || messages.length === 0) return null;
  return messages[index % messages.length] ?? null;
}
