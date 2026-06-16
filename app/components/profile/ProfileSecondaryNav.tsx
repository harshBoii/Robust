'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: '/profile', label: 'Profile', exact: true },
  { href: '/profile/data', label: 'Data Mine' },
  { href: '/profile/integration', label: 'Integrations' },
  { href: '/profile/ads-automation', label: 'Ads Automation' },
  { href: '/profile/analyze-ads', label: 'Analyze Ads' },
  { href: '/profile/jobs', label: 'Jobs' },
] as const;

export function ProfileSecondaryNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none"
      aria-label="Profile sections"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
              active
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
