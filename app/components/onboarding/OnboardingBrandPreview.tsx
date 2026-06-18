'use client';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';
import type { DomainPreviewResult } from '@/lib/onboarding/types';
import type { OnboardingCompanySnapshot, OnboardingStep, StartupPlan } from '@/lib/onboarding/types';
import { phaseLabelForStep } from '@/app/components/onboarding/OnboardingPhaseBar';
import {
  Bot,
  CheckCircle2,
  Loader2,
  Palette,
  Share2,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

type Props = {
  step: OnboardingStep;
  company: OnboardingCompanySnapshot | null;
  companyName: string;
  domain: string;
  domainPreview: DomainPreviewResult | null;
  canonicalName: string;
  industry: string;
  oneLiner: string;
  category: string;
  businessModel: string;
  primaryAudience: string;
  metaConnected: boolean;
  shopifyConnected: boolean;
  enriching: boolean;
  plan: StartupPlan | null;
};

function PreviewRow({
  label,
  value,
  pending,
}: {
  label: string;
  value: string | null | undefined;
  pending?: boolean;
}) {
  const filled = Boolean(value?.trim());
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <div className="mt-0.5 shrink-0">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : filled ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <div className="h-4 w-4 rounded-full border border-border" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={filled ? 'text-foreground' : 'text-muted-foreground/60 italic'}>
          {filled ? value : 'Waiting…'}
        </p>
      </div>
    </div>
  );
}

export function OnboardingBrandPreview({
  step,
  company,
  companyName,
  domain,
  domainPreview,
  canonicalName,
  industry,
  oneLiner,
  category,
  businessModel,
  primaryAudience,
  metaConnected,
  shopifyConnected,
  enriching,
  plan,
}: Props) {
  const displayName = canonicalName.trim() || companyName.trim() || company?.name || 'Your brand';
  const displayDomain = domain.trim() || company?.domain || '—';
  const phase = phaseLabelForStep(step);

  return (
    <div className="flex h-full flex-col px-8 py-10 xl:px-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg opacity-80">
            <Image
              src={ROBUST_DNA.markLight}
              alt=""
              width={36}
              height={36}
              className="object-contain dark:hidden"
            />
            <Image
              src={ROBUST_DNA.markDark}
              alt=""
              width={36}
              height={36}
              className="hidden object-contain dark:block"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Live brand preview
            </p>
            <p className="text-xs text-muted-foreground">{phase} phase</p>
          </div>
        </div>
        <Link href="/login" className="text-xs text-muted-foreground hover:text-primary">
          Log in
        </Link>
      </div>

      <div className="mt-8 flex-1 space-y-5 overflow-y-auto">
        <div className="rounded-2xl border border-border bg-background/80 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold text-foreground">
                {displayName}
              </h3>
              <p className="truncate text-sm text-muted-foreground">{displayDomain}</p>
            </div>
          </div>

          {domainPreview?.ok ? (
            <p className="mt-4 rounded-lg bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-primary" />
              {domainPreview.message}
            </p>
          ) : domainPreview && !domainPreview.ok ? (
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {domainPreview.message}
            </p>
          ) : null}

          {enriching ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Learning your brand from {displayDomain}…
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What we know so far
          </p>
          <div className="space-y-4">
            <PreviewRow label="Brand name" value={canonicalName || companyName} pending={enriching} />
            <PreviewRow label="Industry" value={industry} pending={enriching && !industry} />
            <PreviewRow label="One-liner" value={oneLiner} pending={enriching && !oneLiner} />
            <PreviewRow label="Category" value={category} pending={false} />
            <PreviewRow label="Business model" value={businessModel} pending={false} />
            <PreviewRow label="Audience" value={primaryAudience} pending={false} />
          </div>
        </div>

        {(domainPreview?.colorCount || metaConnected || shopifyConnected) ? (
          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Signals detected
            </p>
            <div className="flex flex-wrap gap-2">
              {domainPreview && domainPreview.colorCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium">
                  <Palette className="h-3 w-3 text-primary" />
                  {domainPreview.colorCount} colors
                </span>
              ) : null}
              {domainPreview && domainPreview.productLinkCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium">
                  <ShoppingBag className="h-3 w-3 text-primary" />
                  {domainPreview.productLinkCount} products
                </span>
              ) : null}
              {metaConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  <Share2 className="h-3 w-3" /> Meta
                </span>
              ) : null}
              {shopifyConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[11px] font-medium text-green-700 dark:text-green-300">
                  <ShoppingBag className="h-3 w-3" /> Shopify
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {plan ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Bot className="h-3.5 w-3.5" /> Recommended focus
            </p>
            <p className="text-sm font-medium leading-snug text-foreground">{plan.headline}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
