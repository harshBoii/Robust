'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Crown,
  ImageIcon,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react';
import { SiMeta, SiShopify } from 'react-icons/si';

import {
  EditProfileModal,
  LoginActivityModal,
  PasswordModal,
  SessionsModal,
  TwoFactorModal,
  type ProfileModal,
} from '@/app/components/profile/ProfileModals';
import {
  formatProfileDateShort,
  formatRelativeTime,
  profileCard,
  profileCardHeaderCompact,
  profileGhostButton,
  profileInitials,
  profileRowBorder,
  profileStatusBadge,
} from '@/app/components/profile/profile-utils';
import type { CompanyProfile } from '@/lib/profile/company-profile';

type ProfileClientProps = {
  profile: CompanyProfile;
};

function ProfileSectionCard({
  title,
  icon: Icon,
  iconClassName = 'text-primary',
  action,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`${profileCard} flex min-h-0 flex-col ${className}`}>
      <div className={profileCardHeaderCompact}>
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${iconClassName}`} />
          <h2 className="font-display text-[13px] font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className={`min-h-0 flex-1 px-3 py-2 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'neutral';
}) {
  const tones = profileStatusBadge;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-px font-ui text-[9px] font-semibold ${tones[tone]}`}
    >
      {tone === 'success' && <Check className="h-2.5 w-2.5 stroke-[2.5]" />}
      {tone === 'warning' && <AlertCircle className="h-2.5 w-2.5 stroke-[2.5]" />}
      {label}
    </span>
  );
}

function InfoFieldRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 last:border-b-0 ${profileRowBorder}`}>
      <span className="shrink-0 font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/75">
        {label}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        <span className="truncate font-body text-[11px] font-medium text-foreground">{value}</span>
        {badge}
      </div>
    </div>
  );
}

function CopyableSlug({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex max-w-[140px] items-center gap-1 truncate font-body text-[11px] font-medium text-foreground hover:text-primary"
      onClick={() => {
        void navigator.clipboard.writeText(slug);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span className="truncate">{slug}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      )}
    </button>
  );
}

function SecurityRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/50 ${profileRowBorder}`}
    >
      <span className="font-body text-[11px] font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <div className="text-[11px] text-muted-foreground">{value}</div>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
      </div>
    </button>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  iconBg,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className={`${profileCard} flex items-center gap-2.5 px-2.5 py-2`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-display text-[13px] font-semibold leading-none text-foreground">
          {value}
        </p>
        <p className="mt-0.5 truncate font-ui text-[9px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  connected,
  warn,
}: {
  label: string;
  value: string;
  connected: boolean;
  warn?: boolean;
}) {
  return (
    <li className={`flex items-center justify-between gap-2 py-1.5 last:border-b-0 ${profileRowBorder}`}>
      <div className="min-w-0 flex-1">
        <span className="font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/75">
          {label}
        </span>
        <p className="mt-0.5 truncate font-body text-[11px] text-foreground">{value || '—'}</p>
      </div>
      {warn ? (
        <StatusBadge label="No" tone="warning" />
      ) : connected ? (
        <StatusBadge label="Connected" tone="success" />
      ) : (
        <StatusBadge label="Not linked" tone="neutral" />
      )}
    </li>
  );
}

export default function ProfileClient({ profile }: ProfileClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ProfileModal>(null);

  const metaConnected = Boolean(profile.meta?.adAccountId && profile.meta?.fbPageId);
  const shopifyConnected = Boolean(profile.shopify?.connected);
  const initials = profileInitials(profile.displayName);

  const metaAdLine = [profile.meta?.adAccountName, profile.meta?.adAccountId]
    .filter(Boolean)
    .join(' · ');
  const metaPageLine = [profile.meta?.fbPageName, profile.meta?.fbPageId]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      {/* Hero header */}
      <div className={`${profileCard} relative shrink-0 overflow-hidden`}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 1200 80"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="none"
            stroke="rgba(255,180,170,0.35)"
            strokeWidth="1"
            d="M0,50 Q300,30 600,45 T1200,40"
          />
        </svg>

        <div className="relative flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0">
              <div className="relative h-full w-full overflow-hidden rounded-xl bg-primary/10">
                {profile.logoUrl ? (
                  // User-provided URL — may be any host; avoid next/image domain allowlist.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.logoUrl}
                    alt={profile.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-primary">
                    {initials}
                  </div>
                )}
              </div>
              <button
                type="button"
                title="Edit profile"
                onClick={() => setModal('edit')}
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card shadow-sm"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>

            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-semibold leading-tight text-foreground">
                {profile.displayName}
              </h1>
              <p className="truncate font-body text-[11px] text-muted-foreground">
                @{profile.userName ?? profile.slug}
                {profile.email ? ` · ${profile.email}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {metaConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-px font-ui text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <SiMeta className="h-2.5 w-2.5" />
                    Meta Connected
                  </span>
                )}
                {shopifyConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#95bf47]/15 px-1.5 py-px font-ui text-[9px] font-semibold text-[#5e8e3e]">
                    <SiShopify className="h-2.5 w-2.5" />
                    Shopify Connected
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-px font-ui text-[9px] font-semibold text-violet-700 dark:text-violet-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI Enabled
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-1.5 py-px font-ui text-[9px] font-semibold text-orange-700 dark:text-orange-400">
                  <Crown className="h-2.5 w-2.5" />
                  Workspace Owner
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/profile/integration"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
            >
              <SiMeta className="h-3 w-3" />
              Manage Meta
            </Link>
            <Link
              href="/profile/integration"
              className={`${profileGhostButton} gap-1.5 font-semibold`}
            >
              <SiShopify className="h-3 w-3 text-[#5e8e3e]" />
              Manage Shopify
            </Link>
            <Link href="/profile/data" className={profileGhostButton}>
              Data Mine
            </Link>
            <Link href="/profile/analyze-ads" className={profileGhostButton}>
              Analyze Ads
            </Link>
            <button type="button" onClick={() => setModal('edit')} className={profileGhostButton}>
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted/50"
              aria-label="More options"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard
          icon={ImageIcon}
          value={profile.stats.assets.toLocaleString('en-US')}
          label="Creatives Uploaded"
          iconBg="bg-red-500/10"
          iconColor="text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={MessageSquare}
          value={profile.stats.adChatSessions.toLocaleString('en-US')}
          label="Chats"
          iconBg="bg-violet-500/10"
          iconColor="text-violet-600 dark:text-violet-400"
        />
        <StatCard
          icon={SiMeta}
          value={
            profile.meta && metaConnected
              ? formatRelativeTime(profile.meta.lastSyncedAt)
              : 'Not connected'
          }
          label="Meta · Last OAuth"
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
        />
        <StatCard
          icon={Calendar}
          value={formatProfileDateShort(profile.createdAt)}
          label="Member Since"
          iconBg="bg-orange-500/10"
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Main body — fills remaining height */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12 lg:grid-rows-2">
        {/* Workspace Information */}
        <ProfileSectionCard
          className="lg:col-span-8 lg:row-span-1"
          bodyClassName="overflow-hidden"
          title="Workspace Information"
          icon={User}
          action={
            <button
              type="button"
              onClick={() => setModal('edit')}
              className="font-ui text-[10px] font-medium text-muted-foreground hover:text-primary"
            >
              Edit
            </button>
          }
        >
          <div className="grid h-full grid-cols-2 gap-x-4">
            <div>
              <p className="mb-0.5 font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
                Personal
              </p>
              <InfoFieldRow label="Username" value={profile.userName ?? '—'} />
              <InfoFieldRow
                label="Email"
                value={profile.email ?? '—'}
                badge={
                  profile.email && profile.emailVerified ? (
                    <StatusBadge label="Verified" tone="success" />
                  ) : null
                }
              />
              <InfoFieldRow label="Slug" value={<CopyableSlug slug={profile.slug} />} />
              <InfoFieldRow
                label="Member Since"
                value={formatProfileDateShort(profile.createdAt)}
              />
              <InfoFieldRow
                label="Updated"
                value={formatProfileDateShort(profile.updatedAt)}
              />
            </div>
            <div>
              <p className="mb-0.5 font-ui text-[9px] font-bold uppercase tracking-wide text-muted-foreground/60">
                Company
              </p>
              <InfoFieldRow label="Name" value={profile.name} />
              <InfoFieldRow label="Domain" value={profile.domain ?? '—'} />
              <InfoFieldRow label="Website" value={profile.website ?? '—'} />
              <InfoFieldRow label="Description" value={profile.description ?? '—'} />
            </div>
          </div>
        </ProfileSectionCard>

        {/* Workspace Status */}
        <ProfileSectionCard
          className="lg:col-span-4 lg:row-span-1"
          title="Workspace Status"
          icon={BarChart3}
        >
          <ul>
            {[
              {
                label: 'Meta Connection',
                value: (
                  <StatusBadge
                    label={metaConnected ? 'Connected' : 'Not connected'}
                    tone={metaConnected ? 'success' : 'neutral'}
                  />
                ),
              },
              {
                label: 'Shopify Connection',
                value: (
                  <StatusBadge
                    label={shopifyConnected ? 'Connected' : 'Not connected'}
                    tone={shopifyConnected ? 'success' : 'neutral'}
                  />
                ),
              },
              {
                label: 'Last OAuth',
                value: profile.meta ? formatRelativeTime(profile.meta.lastSyncedAt) : '—',
              },
              {
                label: 'Shop Products',
                value: profile.shopify?.productCount ?? 0,
              },
              { label: 'Creatives', value: profile.stats.assets },
              { label: 'Chats', value: profile.stats.adChatSessions },
              { label: 'Ad Presets', value: profile.stats.adPresets },
              { label: 'Notifications', value: profile.stats.notifications },
            ].map(({ label, value }) => (
              <li
                key={label}
                className={`flex items-center justify-between gap-2 py-1.5 last:border-b-0 ${profileRowBorder}`}
              >
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span className="text-[11px] font-medium text-foreground">{value}</span>
              </li>
            ))}
          </ul>
        </ProfileSectionCard>

        {/* Meta Integration */}
        <ProfileSectionCard
          className="lg:col-span-6 lg:row-span-1"
          bodyClassName="overflow-y-auto"
          title="Meta Integration"
          icon={SiMeta}
          iconClassName="text-[#0081FB]"
          action={
            <Link
              href="/profile/integration"
              className="font-ui text-[10px] font-medium text-muted-foreground hover:text-primary"
            >
              Manage
            </Link>
          }
        >
          {profile.meta ? (
            <ul>
              <MetaRow
                label="Ad Account"
                value={metaAdLine}
                connected={Boolean(profile.meta.adAccountId)}
              />
              <MetaRow
                label="Facebook Page"
                value={metaPageLine}
                connected={Boolean(profile.meta.fbPageId)}
              />
              <MetaRow
                label="Instagram"
                value={profile.meta.instagramHandle ?? '—'}
                connected={Boolean(profile.meta.instagramHandle)}
              />
              <MetaRow
                label="Brand Voice"
                value={profile.meta.hasBrandVoice ? 'Yes' : 'No'}
                connected={profile.meta.hasBrandVoice}
                warn={!profile.meta.hasBrandVoice}
              />
              <MetaRow
                label="Context"
                value={
                  profile.meta.contextBuiltAt
                    ? formatProfileDateShort(profile.meta.contextBuiltAt)
                    : 'No'
                }
                connected={Boolean(profile.meta.contextBuiltAt)}
                warn={!profile.meta.contextBuiltAt}
              />
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Not connected.{' '}
              <Link href="/profile/integration" className="text-primary hover:underline">
                Connect
              </Link>
            </p>
          )}
        </ProfileSectionCard>

        {/* Shopify Integration */}
        <ProfileSectionCard
          className="lg:col-span-6 lg:row-span-1"
          bodyClassName="overflow-y-auto"
          title="Shopify Integration"
          icon={SiShopify}
          iconClassName="text-[#5e8e3e]"
          action={
            <Link
              href="/profile/integration"
              className="font-ui text-[10px] font-medium text-muted-foreground hover:text-primary"
            >
              Manage
            </Link>
          }
        >
          {profile.shopify?.connected ? (
            <ul>
              <MetaRow
                label="Store"
                value={profile.shopify.shopDomain ?? '—'}
                connected
              />
              <MetaRow
                label="Products synced"
                value={String(profile.shopify.productCount)}
                connected={profile.shopify.productCount > 0}
              />
              <MetaRow
                label="Last product sync"
                value={
                  profile.shopify.lastSyncedAt
                    ? formatRelativeTime(profile.shopify.lastSyncedAt)
                    : '—'
                }
                connected={Boolean(profile.shopify.lastSyncedAt)}
              />
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Not connected.{' '}
              <Link href="/profile/integration" className="text-primary hover:underline">
                Connect
              </Link>
            </p>
          )}
        </ProfileSectionCard>

        {/* Security */}
        <ProfileSectionCard className="lg:col-span-6 lg:row-span-1" title="Security & Access" icon={Lock}>
          <SecurityRow label="Password" value="••••••••" onClick={() => setModal('password')} />
          <SecurityRow
            label="Two-Factor Authentication"
            value={
              profile.twoFactorEnabled ? (
                <StatusBadge label="Enabled" tone="success" />
              ) : (
                'Not enabled'
              )
            }
            onClick={() => setModal('2fa')}
          />
          <SecurityRow
            label="Active Sessions"
            value={
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {profile.security.activeSessions}
              </span>
            }
            onClick={() => setModal('sessions')}
          />
          <SecurityRow
            label="Login Activity"
            value="View sign-ins"
            onClick={() => setModal('login-activity')}
          />
        </ProfileSectionCard>
      </div>

      {modal === 'edit' && <EditProfileModal profile={profile} onClose={() => setModal(null)} />}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
      {modal === '2fa' && (
        <TwoFactorModal
          enabled={profile.twoFactorEnabled}
          onClose={() => setModal(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {modal === 'sessions' && <SessionsModal onClose={() => setModal(null)} />}
      {modal === 'login-activity' && <LoginActivityModal onClose={() => setModal(null)} />}
    </div>
  );
}
