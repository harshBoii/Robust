'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Inbox, LayoutDashboard, LogOut, Shield } from 'lucide-react';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', href: '/superadmin/home', icon: LayoutDashboard },
  { id: 'requests', label: 'Requests', href: '/superadmin/requests', icon: Inbox },
] as const;

function NavIcon({
  icon: Icon,
  label,
  href,
  isActive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className="flex w-full flex-col items-center select-none"
    >
      <span
        className={`sidebar-icon relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
          isActive
            ? 'active text-primary'
            : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span
        className={`font-ui mt-0.5 text-center text-[9px] leading-none transition-colors duration-200 ${
          isActive ? 'font-semibold text-primary' : 'text-muted-foreground/40'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function SuperadminSideBar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="sticky top-0 flex h-screen">
      <aside className="glass-sidebar z-20 flex w-16 shrink-0 flex-col items-center py-4">
        <div className="mb-5 flex w-full flex-col items-center select-none">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
            <Image
              src={ROBUST_DNA.markLight}
              alt=""
              width={28}
              height={28}
              className="object-contain dark:hidden"
            />
            <Image
              src={ROBUST_DNA.markDark}
              alt=""
              width={28}
              height={28}
              className="hidden object-contain dark:block"
            />
          </div>
          <span className="font-ui mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold text-primary">
            <Shield className="h-2.5 w-2.5" />
            Admin
          </span>
        </div>

        <div className="w-full px-2">
          <div className="h-px w-full bg-[var(--glass-border)] opacity-50" />
        </div>

        <nav className="mt-4 flex w-full flex-1 flex-col items-center gap-1.5 px-2">
          {NAV_ITEMS.map((item) => (
            <NavIcon
              key={item.id}
              icon={item.icon}
              label={item.label}
              href={item.href}
              isActive={
                pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false)
              }
            />
          ))}
        </nav>

        <div className="mt-auto flex w-full flex-col items-center gap-1 px-2 pt-4">
          <div className="w-full">
            <div className="h-px w-full bg-[var(--glass-border)] opacity-50" />
          </div>
          <p className="font-ui mt-2 max-w-[52px] truncate text-center text-[9px] text-muted-foreground/60">
            {userName}
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            title="Log out"
            className="sidebar-icon flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-[var(--glass-hover)] hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>
    </div>
  );
}
