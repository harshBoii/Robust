/** Random expected wait between 1:15 and 2:00 for chat busy status UI. */

const ETA_MIN_MS = 75_000;
const ETA_MAX_MS = 120_000;

export function randomBusyEtaMs(): number {
  return ETA_MIN_MS + Math.floor(Math.random() * (ETA_MAX_MS - ETA_MIN_MS + 1));
}

/** e.g. 95000 → "1:35" */
export function formatBusyEtaClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatSavedSecondsMessage(savedSeconds: number): string {
  const n = Math.max(1, Math.round(savedSeconds));
  return `We saved you ${n} second${n === 1 ? '' : 's'}`;
}
