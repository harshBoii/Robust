'use client';

import { useRouter } from 'next/navigation';
import { Leaf, Megaphone } from 'lucide-react';
import { SiMeta } from 'react-icons/si';

import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';
import { INTEGRATIONS_PATH, ORGANIC_LANDING_PATH } from '@/lib/nav/paid-growth';

const STEPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Open Profile → Integrations',
    detail: 'The Meta card is the first one in the grid.',
  },
  {
    title: 'Click Manage on the Meta card',
    detail: 'This opens the connection panel.',
  },
  {
    title: 'Sign in with Facebook',
    detail:
      'Approve access for the business account that owns your ad account. You will be sent back here when it completes.',
  },
  {
    title: 'Pick your ad account and page',
    detail:
      'Paid Growth needs both. Until each is selected the connection counts as incomplete.',
  },
];

/**
 * Blocking dialog for the Paid Growth section when Meta is not connected.
 *
 * Deliberately not dismissable by backdrop or Escape — every page behind it errors without
 * the integration, so dismissing would only reveal a broken screen. Both exits are
 * explicit: finish the connection, or go somewhere that works.
 */
export function MetaRequiredDialog() {
  const router = useRouter();

  return (
    <ModalPortal>
      <ModalBackdrop
        contentClassName="max-w-lg"
        shellProps={{ role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'meta-required-title' }}
      >
        <div className="w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
          <div className="flex items-start gap-3 border-b border-[var(--glass-border)] px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0081FB]/10">
              <SiMeta className="h-5 w-5 text-[#0081FB]" />
            </div>
            <div className="min-w-0">
              <h2 id="meta-required-title" className="font-display text-base font-semibold">
                Connect Meta to use Paid Growth
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Every page in this section reads live data from your Meta ad account, so it
                cannot load until the integration is finished.
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Four steps, about two minutes
            </p>
            <ol className="mt-3 space-y-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--glass-hover)] text-[11px] font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] px-5 py-4 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push(INTEGRATIONS_PATH)}
              className="glass-button-primary inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <Megaphone className="h-4 w-4" />
              Connect Meta
            </button>
            <button
              type="button"
              onClick={() => router.push(ORGANIC_LANDING_PATH)}
              className="glass-button inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
            >
              <Leaf className="h-4 w-4" />
              Go to Organic Marketing
            </button>
          </div>

          <p className="px-5 pb-4 text-[11px] text-muted-foreground">
            Organic Marketing, Chats, Templates and Gallery all work without Meta.
          </p>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
