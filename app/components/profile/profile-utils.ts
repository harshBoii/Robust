/** Theme-aware layout tokens for /profile/* pages */
export const profilePageShell =
  '-m-3 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted/30 p-2 sm:-m-4 sm:p-3 md:-m-5 md:p-3';

export const profileCard =
  'overflow-hidden rounded-xl border border-border bg-card shadow-sm';

export const profileCardHeader =
  'flex items-center justify-between gap-3 border-b border-border px-3 py-2.5';

export const profileCardHeaderCompact =
  'flex shrink-0 items-center justify-between border-b border-border px-3 py-2';

export const profileRowBorder = 'border-b border-border';

export const profileGhostButton =
  'inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground';

export const profileStatusBadge = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  neutral: 'bg-muted text-muted-foreground',
} as const;

export const profileIntegrationCard =
  'flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-border hover:bg-muted/30';

export function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const PROFILE_LOCALE = 'en-US';

export function formatProfileDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(PROFILE_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatProfileDateShort(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(PROFILE_LOCALE, { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatProfileDateShort(iso);
}
