'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Plug, Share2 } from 'lucide-react';
import { SiMeta, SiShopify, SiReddit, SiX } from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';

import {
  MetaConnectionModal,
  ShopifyConnectionModal,
  SocialConnectionModal,
} from '@/app/components/profile/IntegrationConnectionModals';
import type { ProviderStatus } from '@/app/components/profile/SocialProviderConnectionPanel';
import { socialProviderLabel } from '@/lib/auth/social-oauth-state';
import {
  profileCard,
  profileCardHeader,
  profileGhostButton,
  profileIntegrationCard,
} from '@/app/components/profile/profile-utils';
import type { SocialProvider } from '@/app/generated/prisma/client';
import { fromZernioPlatform } from '@/lib/zernio/platforms';

type IntegrationModal = 'meta' | 'shopify' | SocialProvider | null;

type CardConfig = {
  id: IntegrationModal;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
};

const SOCIAL_CARDS: CardConfig[] = [
  {
    id: 'X',
    label: 'X',
    description: 'Publish bounty content to X',
    icon: SiX,
  },
  {
    id: 'LINKEDIN',
    label: 'LinkedIn',
    description: 'Publish bounty content to LinkedIn',
    icon: FaLinkedin,
    iconClassName: 'text-[#0A66C2]',
  },
  {
    id: 'REDDIT',
    label: 'Reddit',
    description: 'Publish bounty content to Reddit',
    icon: SiReddit,
    iconClassName: 'text-[#FF4500]',
  },
];

const ZERNIO_ERROR_MESSAGES: Record<string, string> = {
  config: 'Zernio is not configured (ZERNIO_API_KEY missing).',
  connect: 'Could not start social connection. Try again.',
  invalid_provider: 'Invalid social platform.',
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        connected
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

function IntegrationCard({
  label,
  description,
  icon: Icon,
  iconClassName,
  connected,
  onManage,
  onDisconnect,
  disconnecting = false,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  connected: boolean;
  onManage: () => void;
  onDisconnect?: () => void;
  disconnecting?: boolean;
}) {
  return (
    <div className={`${profileIntegrationCard} flex flex-col`}>
      <button type="button" onClick={onManage} className="flex w-full flex-col items-start gap-3 text-left">
        <div className="flex w-full items-start justify-between gap-2">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${iconClassName ?? ''}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <StatusBadge connected={connected} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </div>
      </button>
      {connected && onDisconnect ? (
        <div className="mt-1 flex w-full gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onManage}
            className={`${profileGhostButton} flex-1 justify-center`}
          >
            Manage
          </button>
          <button
            type="button"
            onClick={() => void onDisconnect()}
            disabled={disconnecting}
            className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function providerFromZernioParam(value: string | null): SocialProvider | null {
  if (!value) return null;
  return fromZernioPlatform(value.toLowerCase());
}

export default function IntegrationPageClient() {
  const [modal, setModal] = useState<IntegrationModal>(null);
  const [metaConnected, setMetaConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [socialProviders, setSocialProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [zernioError, setZernioError] = useState<string | null>(null);
  const [zernioSuccess, setZernioSuccess] = useState<string | null>(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState<SocialProvider | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [meta, shopify, social] = await Promise.all([
        json<{
          hasAdAccountAndPage: boolean;
        }>(await fetch('/api/meta/integration')).catch(() => ({ hasAdAccountAndPage: false })),
        json<{ connected: boolean }>(
          await fetch('/api/company/shopify-app', { credentials: 'include' }),
        ).catch(() => ({ connected: false })),
        json<{ providers: ProviderStatus[] }>(
          await fetch('/api/integrations/social', { credentials: 'include' }),
        ).catch(() => ({ providers: [] })),
      ]);
      setMetaConnected(meta.hasAdAccountAndPage);
      setShopifyConnected(shopify.connected);
      setSocialProviders(social.providers);
    } catch (e) {
      setZernioError(e instanceof Error ? e.message : 'Failed to load integrations');
    }
  }, []);

  const bootstrapZernio = useCallback(async () => {
    setLoading(true);
    setZernioError(null);
    try {
      await json(
        await fetch('/api/integrations/zernio/ensure-profile', {
          method: 'POST',
          credentials: 'include',
        }),
      );
      await json(
        await fetch('/api/integrations/zernio/sync', {
          method: 'POST',
          credentials: 'include',
        }),
      );
      await loadStatus();
    } catch (e) {
      setZernioError(e instanceof Error ? e.message : 'Failed to initialize Zernio');
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    void bootstrapZernio();
  }, [bootstrapZernio]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let shouldCleanUrl = false;

    if (params.get('meta_oauth') || params.has('meta_oauth')) {
      setModal('meta');
      shouldCleanUrl = true;
    } else if (params.get('shopify_connected') || params.get('shopify_error')) {
      setModal('shopify');
      shouldCleanUrl = true;
    } else {
      const zernioErrorParam = params.get('zernio_error');
      if (zernioErrorParam) {
        setZernioError(ZERNIO_ERROR_MESSAGES[zernioErrorParam] ?? 'Social connection failed.');
        shouldCleanUrl = true;
      }

      const connectedPlatform =
        params.get('zernio_connected') ?? params.get('connected');
      const provider = providerFromZernioParam(connectedPlatform);
      if (provider) {
        setModal(provider);
        setZernioSuccess(`${provider} connected successfully.`);
        shouldCleanUrl = true;
      } else {
        const modalParam = params.get('modal');
        if (modalParam === 'meta' || modalParam === 'shopify') {
          setModal(modalParam);
        } else if (modalParam === 'x') setModal('X');
        else if (modalParam === 'linkedin') setModal('LINKEDIN');
        else if (modalParam === 'reddit') setModal('REDDIT');
      }
    }

    if (shouldCleanUrl) {
      params.delete('meta_oauth');
      params.delete('shopify_connected');
      params.delete('shopify_error');
      params.delete('zernio_error');
      params.delete('zernio_connected');
      params.delete('connected');
      params.delete('profileId');
      params.delete('accountId');
      params.delete('username');
      params.delete('provider');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, []);

  const dismissModal = () => setModal(null);

  const socialConnected = (provider: SocialProvider) =>
    socialProviders.find((p) => p.provider === provider)?.connected ?? false;

  const disconnectSocial = async (provider: SocialProvider) => {
    setDisconnectingProvider(provider);
    setZernioError(null);
    setZernioSuccess(null);
    try {
      await json(
        await fetch('/api/integrations/social', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        }),
      );
      setZernioSuccess(`${socialProviderLabel(provider)} disconnected.`);
      if (modal === provider) setModal(null);
      await loadStatus();
    } catch (e) {
      setZernioError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setDisconnectingProvider(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className={`${profileCard} shrink-0`}>
        <div className={profileCardHeader}>
          <div className="flex min-w-0 items-center gap-2">
            <Plug className="h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
                Integrations
              </h1>
              <p className="font-body text-[11px] text-muted-foreground">
                Connect Meta, Shopify, and social accounts via Zernio
              </p>
            </div>
          </div>
          <Link href="/profile" className={`${profileGhostButton} shrink-0`}>
            <ChevronLeft className="h-3 w-3" />
            Profile
          </Link>
        </div>
      </div>

      <div className={`${profileCard} min-h-0 flex-1 overflow-y-auto p-3`}>
        {zernioError ? (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            {zernioError}
          </div>
        ) : null}
        {zernioSuccess ? (
          <div className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {zernioSuccess}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading integrations…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <IntegrationCard
              label="Meta"
              description="Facebook ad account and page for paid growth"
              icon={SiMeta}
              iconClassName="text-[#0081FB]"
              connected={metaConnected}
              onManage={() => setModal('meta')}
            />
            <IntegrationCard
              label="Shopify"
              description="Sync products from your Shopify store"
              icon={SiShopify}
              iconClassName="text-[#5e8e3e]"
              connected={shopifyConnected}
              onManage={() => setModal('shopify')}
            />
            {SOCIAL_CARDS.map((card) => {
              const provider = card.id as SocialProvider;
              const connected = socialConnected(provider);
              return (
                <IntegrationCard
                  key={card.id}
                  label={card.label}
                  description={card.description}
                  icon={card.icon}
                  iconClassName={card.iconClassName}
                  connected={connected}
                  onManage={() => setModal(card.id)}
                  onDisconnect={connected ? () => disconnectSocial(provider) : undefined}
                  disconnecting={disconnectingProvider === provider}
                />
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Share2 className="h-3 w-3" />
          Social connections are used to publish ads and bounty content.
        </div>
      </div>

      {modal === 'meta' ? <MetaConnectionModal onClose={dismissModal} /> : null}
      {modal === 'shopify' ? <ShopifyConnectionModal onClose={dismissModal} /> : null}
      {modal === 'X' || modal === 'LINKEDIN' || modal === 'REDDIT' ? (
        <SocialConnectionModal provider={modal} onClose={dismissModal} />
      ) : null}
    </div>
  );
}
