'use client';

import { X } from 'lucide-react';

import ManagerMetaClient from '@/app/components/manager/ManagerMetaClient';
import ManagerShopifyClient from '@/app/components/manager/ManagerShopifyClient';
import ManagerWordPressClient from '@/app/components/manager/ManagerWordPressClient';
import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';
import SocialProviderConnectionPanel from '@/app/components/profile/SocialProviderConnectionPanel';
import type { SocialProvider } from '@/app/generated/prisma/client';
import { socialProviderLabel } from '@/lib/auth/social-oauth-state';

type IntegrationModalShellProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

function IntegrationModalShell({ title, onClose, children }: IntegrationModalShellProps) {
  return (
    <ModalPortal>
      <ModalBackdrop onClose={onClose} contentClassName="max-w-2xl">
        <div className="max-h-[90vh] w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
            <h3 className="font-display text-sm font-semibold">{title}</h3>
            <button type="button" onClick={onClose} className="glass-button rounded-lg p-1.5">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="custom-scrollbar max-h-[calc(90vh-3.5rem)] overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

function closeModalAfterConnect(onClose: () => void) {
  window.setTimeout(onClose, 2000);
}

export function MetaConnectionModal({ onClose }: { onClose: () => void }) {
  return (
    <IntegrationModalShell title="Meta connection" onClose={onClose}>
      <ManagerMetaClient
        embedded
        onConnectClick={() => closeModalAfterConnect(onClose)}
      />
    </IntegrationModalShell>
  );
}

export function ShopifyConnectionModal({ onClose }: { onClose: () => void }) {
  return (
    <IntegrationModalShell title="Shopify connection" onClose={onClose}>
      <ManagerShopifyClient
        embedded
        onConnectClick={() => closeModalAfterConnect(onClose)}
      />
    </IntegrationModalShell>
  );
}

export function WordPressConnectionModal({ onClose }: { onClose: () => void }) {
  return (
    <IntegrationModalShell title="WordPress connection" onClose={onClose}>
      <ManagerWordPressClient
        embedded
        onConnectClick={() => closeModalAfterConnect(onClose)}
      />
    </IntegrationModalShell>
  );
}

export function SocialConnectionModal({
  provider,
  onClose,
}: {
  provider: SocialProvider;
  onClose: () => void;
}) {
  return (
    <IntegrationModalShell title={`${socialProviderLabel(provider)} connection`} onClose={onClose}>
      <SocialProviderConnectionPanel
        provider={provider}
        embedded
        onConnectClick={() => closeModalAfterConnect(onClose)}
      />
    </IntegrationModalShell>
  );
}
