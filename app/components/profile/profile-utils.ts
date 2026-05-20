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
