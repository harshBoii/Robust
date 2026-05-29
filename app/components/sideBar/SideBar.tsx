'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell, Settings, BarChart3, LayoutDashboard,
  Upload, FolderOpen, Image as ImageIcon,
  Play, PauseCircle, PlusCircle, CalendarClock,
  SlidersHorizontal, Megaphone, History,
  ShieldCheck, ScrollText,   MessageSquare,
  LayoutTemplate,
  User,
  Database,
  Sparkles,
  Leaf,
  X,
  Crosshair,
  FileText,
} from 'lucide-react';
import ThemeToggle from '@/app/components/UI/ThemeToggle';
import ChatsHistoryList from '@/app/components/chats/ChatsHistoryList';
import GalleryUploadZone from '@/app/(frontend)/(workspace)/gallery/GalleryUploadZone';
import { SiMeta, SiShopify } from 'react-icons/si';

/* ============================================
   INLINE SVG ICONS
============================================ */
const IconHome = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconManager = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
);
const IconGallery = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);
const IconChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const IconChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconLogOut = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);
const IconHelp = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/* ============================================
   SECTIONS CONFIG
============================================ */
type MainSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hasSecondary: boolean;
  hidden?: boolean;
};

type NavGroup = {
  label: string;
  items: MainSection[];
};

const MAIN_SECTIONS: MainSection[] = [
  { id: 'home',      label: 'Home',      icon: IconHome,    hasSecondary: true },
  { id: 'chats',     label: 'Chats',     icon: MessageSquare, hasSecondary: true },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, hasSecondary: true },
  { id: 'paid-growth', label: 'Paid Growth', icon: Megaphone, hasSecondary: true },
  { id: 'gallery',   label: 'Gallery',   icon: IconGallery, hasSecondary: true },
  { id: 'organic',   label: 'Organic Marketing', icon: Leaf, hasSecondary: true },
  { id: 'profile',   label: 'Profile',   icon: User,        hasSecondary: true },
  { id: 'workspace', label: 'Workspace', icon: Settings,    hasSecondary: true, hidden: true },
];

const PRIMARY_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Chats',
    items: [
      { id: 'chats',     label: 'Chats',     icon: MessageSquare, hasSecondary: true },
    ],
  },
  {
    label: 'Paid Growth',
    items: [
      { id: 'paid-growth', label: 'Paid Growth', icon: Megaphone, hasSecondary: true },
    ],
  },
  {
    label: 'Organic Growth',
    items: [
      { id: 'organic', label: 'Organic Marketing', icon: Leaf, hasSecondary: true },
    ],
  },
  {
    label: 'Templates',
    items: [
      { id: 'templates', label: 'Templates', icon: LayoutTemplate, hasSecondary: true },
    ],
  },
  {
    label: 'Gallery',
    items: [
      { id: 'gallery', label: 'Gallery', icon: IconGallery, hasSecondary: true },
    ],
  },
];

/* ============================================
   PRIMARY SIDEBAR ICON
============================================ */
const PrimarySidebarIcon = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <div className="flex w-full flex-col items-center select-none">
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`sidebar-icon relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
        isActive
          ? 'active text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)]'
      }`}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
    <span
      className={`font-ui mt-0.5 text-[9px] leading-none text-center transition-colors duration-200 ${
        isActive
          ? 'text-primary font-semibold'
          : 'text-muted-foreground opacity-40'
      }`}
    >
      {label}
    </span>
  </div>
);

/* ============================================
   SECONDARY NAV ITEM
============================================ */
type IconComponentType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const SecondaryNavButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconComponentType;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="
      relative flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-left
      font-body text-[13px] transition-all duration-150
      text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground
    "
  >
    {Icon && (
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    )}
    <span className="flex-1 truncate">{label}</span>
  </button>
);

const SecondaryNavItem = ({
  icon: Icon,
  label,
  href,
  exact = false,
}: {
  icon: IconComponentType;
  label: string;
  href: string;
  exact?: boolean;
}) => {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || (href !== '/' && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg
        font-body text-[13px] transition-all duration-150
        ${isActive
          ? 'text-primary font-medium bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)]'
        }
      `}
    >
      {/* Active indicator bar */}
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r-full bg-primary transition-all duration-200 ${
          isActive ? 'h-[14px] opacity-100' : 'h-0 opacity-0'
        }`}
      />
      {Icon && (
        <Icon
          className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
            isActive ? 'text-primary' : ''
          }`}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
};

const DisabledSecondaryNavItem = ({
  icon: Icon,
  label,
  badge,
}: {
  icon: IconComponentType;
  label: string;
  badge: string;
}) => (
  <div
    className="relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg font-body text-[13px] cursor-not-allowed select-none text-muted-foreground/40"
    aria-disabled
  >
    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />}
    <span className="flex-1 truncate opacity-60">{label}</span>
    <span className="glass-badge text-[9px] px-2 py-0.5 opacity-50">
      {badge}
    </span>
  </div>
);

/* ============================================
   SECTION LABEL
============================================ */
const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-3 pt-5 pb-1.5">
    <span className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/40">
      {label}
    </span>
  </div>
);

/* ============================================
   NOTIFICATIONS PANEL
============================================ */
type AutomationEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

/* These are semantic event-type colors — intentionally not from the design token palette */
const ruleTypeColor: Record<string, string> = {
  AUTO_PAUSE:           '#f97316',
  FATIGUE_ALERT:        '#eab308',
  BUDGET_PACING:        '#3b82f6',
  SPEND_CONCENTRATION:  '#a855f7',
  WINNER_AMPLIFICATION: '#22c55e',
};

const NotificationsPanel = () => {
  const [items,   setItems]   = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch('/api/notifications', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setItems(Array.isArray(data?.notifications) ? data.notifications : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-2 pt-3">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-1 mb-5 pb-3 border-b border-[var(--glass-border)]">
        <div className="flex h-5 w-5 items-center justify-center rounded-md flex-shrink-0 bg-amber-500/15">
          <Bell className="h-3 w-3 text-amber-500" />
        </div>
        <span className="font-display text-[1rem] font-semibold flex-1 text-foreground">
          Notifications
        </span>
        {loading && (
          <span className="font-ui text-[10px] animate-pulse text-muted-foreground/40">
            Loading…
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Empty state */}
        {items.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-2 py-6 rounded-xl border border-dashed border-[var(--glass-border)] text-center">
            <Bell className="h-4 w-4 text-muted-foreground/20" />
            <span className="font-ui text-[10px] leading-snug px-3 text-muted-foreground/35">
              All clear — no new alerts
            </span>
          </div>
        )}

        {items.map((n) => {
          const accentColor = ruleTypeColor[n.type] ?? 'var(--primary)';
          return (
            <div
              key={n.id}
              className="glass rounded-xl overflow-hidden transition-all duration-200"
              style={{
                borderColor: n.isRead
                  ? 'var(--glass-border)'
                  : `color-mix(in srgb, ${accentColor} 30%, var(--glass-border))`,
              }}
            >
              {/* Event type header strip */}
              <div
                className="flex items-center gap-1.5 border-b px-2.5 py-1.5"
                style={{
                  background:  `color-mix(in srgb, ${accentColor} 8%, transparent)`,
                  borderColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: accentColor, opacity: n.isRead ? 0.4 : 1 }}
                />
                <span
                  className="font-ui text-[9.5px] font-semibold leading-none truncate"
                  style={{ color: accentColor }}
                >
                  {n.type.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Notification body */}
              <div className="p-2.5 space-y-1">
                <p className="font-body text-[11px] font-semibold leading-snug text-foreground">
                  {n.title}
                </p>
                <p className="font-body text-[10px] leading-snug text-muted-foreground/60">
                  {n.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================
   SECONDARY SIDEBAR CONTENT
============================================ */
const SecondarySidebarContent = ({
  activeSection,
  onGalleryUploadClick,
}: {
  activeSection: string;
  onGalleryUploadClick?: () => void;
}) => {
  switch (activeSection) {
    case 'home':
      return <NotificationsPanel />;

    case 'chats':
      return (
        <>
          <SectionLabel label="Chats" />
          <SecondaryNavItem icon={PlusCircle} label="New chat" href="/chats" />
          <SectionLabel label="Recents" />
          <ChatsHistoryList />
        </>
      );

    case 'templates':
      return (
        <>
          <SectionLabel label="Templates" />
          <p className="px-3 py-2 text-[12px] leading-snug text-muted-foreground">
            Browse ready-made image recipes. Each template opens a guided chat to collect inputs and
            generate.
          </p>
          <SecondaryNavItem icon={LayoutTemplate} label="Browse templates" href="/templates" />
        </>
      );

    case 'paid-growth':
      return (
        <>
          <SectionLabel label="Dashboard" />
          <SecondaryNavItem icon={IconHome} label="Dashboard" href="/home" />

          <SectionLabel label="Manager" />
          <SecondaryNavItem icon={Megaphone}         label="Post to Meta"     href="/manager/post" />
          <SecondaryNavItem icon={History}           label="Ad History"       href="/manager/history" />
          <SecondaryNavItem icon={PauseCircle}       label="Auto-Pause Rules" href="/manager/rules" />
          <SecondaryNavItem icon={SlidersHorizontal} label="Presets"          href="/manager/presets" />
          <SecondaryNavItem icon={SiMeta}            label="Meta Connection"    href="/manager/meta" />
          <SecondaryNavItem icon={SiShopify}         label="Shopify Connection" href="/manager/shopify" />
          <SecondaryNavItem icon={SiShopify}         label="Shop Products"      href="/shop/products" />

          <SectionLabel label="Report" />
          <SecondaryNavItem icon={BarChart3} label="Report" href="/report" />
        </>
      );

    case 'gallery':
      return (
        <>
          <SectionLabel label="Assets" />
          <SecondaryNavItem icon={FolderOpen} label="All Creatives" href="/gallery" />
          <SecondaryNavItem icon={ImageIcon}  label="Images"        href="/gallery/images" />
          <SecondaryNavItem icon={Play}       label="Videos"        href="/gallery/videos" />

          <SectionLabel label="Upload" />
          <SecondaryNavButton
            icon={Upload}
            label="Upload Assets"
            onClick={() => onGalleryUploadClick?.()}
          />
          <SecondaryNavButton
            icon={PlusCircle}
            label="Bulk Upload"
            onClick={() => onGalleryUploadClick?.()}
          />
        </>
      );

    case 'organic':
      return (
        <>
          <SectionLabel label="Organic Marketing" />
          <SecondaryNavItem icon={BarChart3} label="Dashboard" href="/organic/dashboard" exact />
          <SecondaryNavItem icon={ShieldCheck} label="GeoKnight" href="/organic/geoKnight" />
          <SecondaryNavItem icon={Crosshair} label="Bounty" href="/organic/bounty" exact />
          <SecondaryNavItem icon={FileText} label="Bounty Pages" href="/organic/bounty-pages" />
        </>
      );

    case 'workspace':
      return (
        <>
          <SectionLabel label="Account" />
          {/* <SecondaryNavItem icon={Settings} label="Settings" href="/workspace/settings" /> */}
        </>
      );

    case 'profile':
      return (
        <>
          <SectionLabel label="Profile" />
          <SecondaryNavItem icon={User} label="Overview" href="/profile" exact />
          <SecondaryNavItem icon={Database} label="Data Mine" href="/profile/data" />
          <SecondaryNavItem
            icon={Sparkles}
            label="Analyze Latest Ads"
            href="/profile/analyze-ads"
          />
        </>
      );

    default:
      return (
        <>
          <SectionLabel label="Navigation" />
          <SecondaryNavItem icon={LayoutDashboard} label="Overview" href="/" />
        </>
      );
  }
};

/* ============================================
   DIVIDER
============================================ */
const SidebarDivider = () => (
  <div
    className="mx-auto opacity-50"
    style={{ width: 32, height: 1, background: 'var(--sidebar-glass-border, var(--glass-border))' }}
  />
);

/* ============================================
   SIDEBAR PROFILE AVATAR
============================================ */
function SidebarProfileAvatar({
  logoUrl,
  displayName,
}: {
  logoUrl?: string | null;
  displayName: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initial = displayName.charAt(0).toUpperCase();

  if (logoUrl && !logoFailed) {
    return (
      // User-provided logo URL — may be any host.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={displayName}
        className="h-8 w-8 rounded-lg object-cover"
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fde8e4] font-display text-xs font-bold text-[#e07a5f]">
      {initial}
    </span>
  );
}

/* ============================================
   MAIN APP SIDEBAR
============================================ */
export default function AppSidebar({
  companyId,
  displayName,
  logoUrl,
}: {
  companyId: string;
  displayName?: string;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const [activeSection,    setActiveSection]    = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [galleryUploadModalOpen, setGalleryUploadModalOpen] = useState(false);

  const getFirstRoute = (sectionId: string) => {
    switch (sectionId) {
      case 'home':      return '/home';
      case 'chats':     return '/chats';
      case 'templates': return '/templates';
      case 'paid-growth': return '/home';
      case 'gallery':   return '/gallery';
      case 'organic':   return '/organic/dashboard';
      case 'report':    return '/report';
      case 'profile':   return '/profile';
      case 'workspace': return '/workspace/settings';
      default:          return '/';
    }
  };

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    router.push(getFirstRoute(sectionId));
  };

  const handleGalleryUploadStart = useCallback((_bulkUploadId: string) => {
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('robust-gallery-refresh'));
    }, 3500);
    setGalleryUploadModalOpen(false);
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        console.warn('Logout request failed:', res.status);
      }
    } catch (e) {
      console.warn('Logout request error:', e);
    }
    // Full navigation so the cleared httpOnly cookie is committed before subsequent loads.
    window.location.assign('/login');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if      (pathname === '/')                   setActiveSection('home');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/chats'))     setActiveSection('chats');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/templates')) setActiveSection('templates');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname === '/home' || pathname?.startsWith('/manager') || pathname?.startsWith('/shop') || pathname?.startsWith('/report'))
      setActiveSection('paid-growth');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/create-ad')) setActiveSection('createAd');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/gallery'))   setActiveSection('gallery');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/organic'))   setActiveSection('organic');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/profile'))   setActiveSection('profile');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pathname?.startsWith('/workspace')) setActiveSection('workspace');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else                                         setActiveSection('home');
  }, [pathname]);

  const currentSection = MAIN_SECTIONS.find((s) => s.id === activeSection);
  const showSecondary  = !sidebarCollapsed && currentSection?.hasSecondary;

  const springTransition = {
    type:      'spring' as const,
    stiffness: 420,
    damping:   38,
    mass:      0.85,
  };

  return (
    <div className="flex h-screen sticky top-0 overflow-x-hidden">

      {/* ══════════════════════════════
          PRIMARY SIDEBAR
      ══════════════════════════════ */}
      <aside className="glass-sidebar w-16 flex-shrink-0 flex flex-col items-center py-4 z-20">

        {/* Profile avatar at top */}
        {displayName ? (
          <div className="mb-5 flex w-full flex-col items-center select-none">
            <Link
              href="/profile"
              title={displayName}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                activeSection === 'profile'
                  ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                  : 'hover:bg-[var(--glass-hover)]'
              }`}
            >
              <SidebarProfileAvatar logoUrl={logoUrl} displayName={displayName} />
            </Link>
            <span
              className={`font-ui mt-0.5 max-w-[52px] truncate text-[9px] leading-none ${
                activeSection === 'profile' ? 'font-semibold text-primary' : 'text-muted-foreground/40'
              }`}
            >
              {displayName.split(/\s+/)[0]}
            </span>
          </div>
        ) : (
          <div className="mb-5 h-10 w-10" />
        )}

        <SidebarDivider />
        <div className="mt-4" />

        {/* Main nav */}
        <nav className="flex-1 flex flex-col items-center w-full px-2">
          {PRIMARY_NAV_GROUPS.map((group, groupIndex) => (
            <React.Fragment key={group.label}>
              {groupIndex > 0 && <div className="w-full h-px bg-[var(--glass-border)] opacity-50 my-2" />}
              <div className="flex flex-col items-center gap-1.5 w-full">
                {group.items.map((section) => (
                  <PrimarySidebarIcon
                    key={section.id}
                    icon={section.icon}
                    label={section.label}
                    isActive={activeSection === section.id}
                    onClick={() => handleSectionClick(section.id)}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </nav>

        {/* Bottom utilities */}
        <div className="mt-auto flex flex-col items-center gap-1 pt-4 w-full px-2">
          <SidebarDivider />
          <div className="mt-2" />


          {/* Workspace / Settings */}
          {/* <div className="flex w-full flex-col items-center select-none">
            <button
              type="button"
              onClick={() => handleSectionClick('workspace')}
              title="Workspace"
              className={`sidebar-icon relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                activeSection === 'workspace'
                  ? 'active text-primary'
                  : 'text-muted-foreground opacity-60 hover:opacity-100 hover:bg-[var(--glass-hover)]'
              }`}
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
            <span
              className={`font-ui mt-0.5 text-[9px] leading-none mb-1 transition-colors duration-200 ${
                activeSection === 'workspace'
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground/40'
              }`}
            >
              Settings
            </span>
          </div> */}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Robust logo with hover menu */}
          <div className="mb-1 flex w-full flex-col items-center select-none relative group/logo">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl cursor-pointer transition-colors hover:bg-[var(--glass-hover)]">
              <Image
                src="/mascot/Robust.png"
                alt="Robust"
                fill
                className="object-contain object-center"
                sizes="40px"
                priority
              />
            </div>
            <span className="font-ui mt-0.5 text-[9px] leading-none text-muted-foreground/40">
              Robust
            </span>

            {/* Hover dropdown */}
            <div className="absolute left-full bottom-0 ml-2 opacity-0 invisible group-hover/logo:opacity-100 group-hover/logo:visible transition-all duration-200 z-50">
              <div className="glass rounded-xl border border-[var(--glass-border)] shadow-lg py-2 min-w-[140px]">
                <Link
                  href="/chats"
                  className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)] transition-colors"
                >
                  <IconHelp className="w-3.5 h-3.5" />
                  <span>Help</span>
                </Link>
                <Link
                  href="/privacy-policy"
                  className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)] transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Privacy</span>
                </Link>
                <Link
                  href="/terms-and-conditions"
                  className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)] transition-colors"
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span>Terms</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Log out */}
          <div className="flex w-full flex-col items-center select-none">
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className="sidebar-icon w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-muted-foreground/60 hover:text-destructive hover:bg-[var(--glass-hover)]"
            >
              <IconLogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════
          SECONDARY SIDEBAR
      ══════════════════════════════ */}
      <AnimatePresence initial={false}>
        {showSecondary && (
          <motion.aside
            key="secondary-sidebar"
            className="glass-sidebar-secondary flex-shrink-0 flex flex-col h-screen overflow-hidden"
            style={{ width: 224, minWidth: 224 }}
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0,       opacity: 1 }}
            exit={{    x: '-100%', opacity: 0 }}
            transition={springTransition}
          >
            {/* Header */}
            <div className="px-4 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
                <h2 className="font-display text-[13px] font-semibold truncate text-foreground">
                  {currentSection?.label ?? 'Navigation'}
                </h2>
              </div>

              {/* Collapse button */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="
                  group/collapse glass-button
                  flex h-8 w-8 shrink-0 items-center justify-center
                  rounded-lg transition-all duration-200 active:scale-[0.96]
                  text-foreground hover:text-primary
                "
                title="Collapse sidebar"
              >
                <IconChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover/collapse:-translate-x-px" />
              </button>
            </div>

            {/* Nav content */}
            <nav className="flex-1 overflow-y-auto px-2 py-1 glass-scrollbar">
              <SecondarySidebarContent
                activeSection={activeSection}
                onGalleryUploadClick={
                  companyId ? () => setGalleryUploadModalOpen(true) : undefined
                }
              />
            </nav>

            {/* Footer */}
            <div className="p-3 flex-shrink-0 border-t border-[var(--glass-border)]">
              <button
                type="button"
                onClick={handleLogout}
                className="
                  glass-button w-full flex items-center gap-2
                  px-2.5 py-1.5 rounded-lg
                  font-ui text-[12px] text-muted-foreground/60
                  hover:text-destructive transition-all
                "
              >
                <IconLogOut className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Log out</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════
          COLLAPSED: floating expand tab
      ══════════════════════════════ */}
      {sidebarCollapsed && currentSection?.hasSecondary && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="
            group glass
            fixed left-16 top-1/2 z-10 -translate-y-1/2
            rounded-r-lg border-l-0 px-1.5 py-3
            transition-all hover:px-2
            text-muted-foreground/60 hover:text-primary
          "
          title="Expand sidebar"
        >
          <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      <AnimatePresence>
        {galleryUploadModalOpen && companyId ? (
          <motion.div
            key="gallery-upload-modal"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              aria-label="Close"
              onClick={() => setGalleryUploadModalOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="gallery-upload-modal-title"
              className="glass-modal relative z-[10001] flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-2xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3">
                <h2
                  id="gallery-upload-modal-title"
                  className="font-display text-[15px] font-semibold text-foreground"
                >
                  Upload creatives
                </h2>
                <button
                  type="button"
                  onClick={() => setGalleryUploadModalOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar">
                <GalleryUploadZone
                  companyId={companyId}
                  onUploadStart={handleGalleryUploadStart}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}