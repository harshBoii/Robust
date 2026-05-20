'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  Globe,
  Link2,
  Mail,
  Shield,
  User,
  BarChart3,
  MessageSquare,
  ImageIcon,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';
import { SiMeta } from 'react-icons/si';

import type { CompanyProfile } from '@/lib/profile/company-profile';

type ProfileClientProps = {
  profile: CompanyProfile;
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg-solid)] shadow-[var(--glass-shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-display text-sm font-semibold text-foreground">{label}</h2>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  const display = value?.trim() || '—';
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--glass-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-ui text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {href && value ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[13px] text-primary hover:underline"
        >
          {display}
        </a>
      ) : (
        <span className="font-body text-[13px] text-foreground">{display}</span>
      )}
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function subscriptionLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

function subscriptionTone(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'text-emerald-500';
    case 'PENDING':
      return 'text-amber-500';
    case 'FAILED':
    case 'EXPIRED':
    case 'CANCELLED':
    case 'ON_HOLD':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileClient({ profile }: ProfileClientProps) {
  const metaConnected = Boolean(profile.meta?.adAccountId && profile.meta?.fbPageId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account, company, and workspace details.
        </p>
      </div>

      <Panel className="overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />
        <div className="relative px-5 pb-5">
          <div className="-mt-10 mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-[var(--glass-bg-solid)] bg-[var(--glass-hover)] shadow-md">
                {profile.logoUrl ? (
                  <Image src={profile.logoUrl} alt={profile.name} fill className="object-cover" sizes="80px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 font-display text-2xl font-semibold text-primary">
                    {initials(profile.name)}
                  </div>
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h2 className="font-display truncate text-xl font-semibold text-foreground">{profile.name}</h2>
                <p className="font-body text-sm text-muted-foreground">
                  @{profile.userName ?? profile.slug}
                </p>
              </div>
            </div>
            <Link
              href="/manager/meta"
              className="glass-button inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 font-ui text-[12px] text-foreground transition-colors hover:text-primary sm:self-auto"
            >
              <SiMeta className="h-3.5 w-3.5" />
              {metaConnected ? 'Manage Meta' : 'Connect Meta'}
            </Link>
          </div>

          {profile.description ? (
            <p className="font-body text-sm leading-relaxed text-muted-foreground">{profile.description}</p>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Creatives', value: profile.stats.assets, icon: ImageIcon },
          { label: 'Chats', value: profile.stats.adChatSessions, icon: MessageSquare },
          { label: 'Ad presets', value: profile.stats.adPresets, icon: SlidersHorizontal },
          { label: 'Notifications', value: profile.stats.notifications, icon: Bell },
        ].map(({ label, value, icon: Icon }) => (
          <Panel key={label} className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="font-display text-lg font-semibold text-foreground">{value.toLocaleString()}</p>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle icon={User} label="Account" />
          <InfoRow label="Username" value={profile.userName} />
          <InfoRow label="Email" value={profile.email} />
          <InfoRow label="Company slug" value={profile.slug} />
          <InfoRow label="Member since" value={formatDate(profile.createdAt)} />
          <InfoRow label="Last updated" value={formatDate(profile.updatedAt)} />
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={Building2} label="Company" />
          <InfoRow label="Company name" value={profile.name} />
          <InfoRow label="Domain" value={profile.domain} />
          <InfoRow
            label="Website"
            value={profile.website}
            href={profile.website?.startsWith('http') ? profile.website : profile.website ? `https://${profile.website}` : undefined}
          />
          <InfoRow label="Description" value={profile.description} />
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={Shield} label="Subscription" />
          <div className="flex flex-col gap-0.5 border-b border-[var(--glass-border)] py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-ui text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <span className={`font-body text-[13px] font-medium ${subscriptionTone(profile.subscriptionStatus)}`}>
              {subscriptionLabel(profile.subscriptionStatus)}
            </span>
          </div>
          <InfoRow label="Started" value={formatDate(profile.subscriptionCreatedAt)} />
          <InfoRow label="Last changed" value={formatDate(profile.subscriptionUpdatedAt)} />
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={SiMeta} label="Meta integration" />
          {profile.meta ? (
            <>
              <InfoRow label="Ad account" value={profile.meta.adAccountId} />
              <InfoRow label="Facebook page" value={profile.meta.fbPageId} />
              <InfoRow label="OAuth connected" value={profile.meta.hasUserOAuth ? 'Yes' : 'No'} />
              <InfoRow label="Brand voice built" value={profile.meta.hasBrandVoice ? 'Yes' : 'No'} />
              <InfoRow
                label="Avg winning CTR"
                value={profile.meta.avgWinningCtr != null ? `${profile.meta.avgWinningCtr.toFixed(2)}%` : null}
              />
              <InfoRow label="Context built" value={formatDate(profile.meta.contextBuiltAt)} />
              <InfoRow label="Connected" value={formatDate(profile.meta.connectedAt)} />
            </>
          ) : (
            <p className="font-body text-sm text-muted-foreground">
              Meta is not connected yet.{' '}
              <Link href="/manager/meta" className="text-primary hover:underline">
                Connect your account
              </Link>
            </p>
          )}
        </Panel>
      </div>

      <div className="flex items-center gap-2 px-1 text-muted-foreground/50">
        <Calendar className="h-3.5 w-3.5" />
        <span className="font-ui text-[10px]">
          Profile ID: {profile.id}
        </span>
        {profile.email ? (
          <>
            <span aria-hidden>·</span>
            <Mail className="h-3.5 w-3.5" />
            <span className="font-ui text-[10px]">{profile.email}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
