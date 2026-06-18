'use client';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';
import { Bot, Building2, Globe, Rocket, Search, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export function OnboardingWelcomePanel() {
  return (
    <div className="flex h-full flex-col justify-between px-8 py-10 xl:px-10">
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 overflow-hidden rounded-xl">
          <Image
            src={ROBUST_DNA.markLight}
            alt=""
            width={44}
            height={44}
            className="object-contain dark:hidden"
            priority
          />
          <Image
            src={ROBUST_DNA.markDark}
            alt=""
            width={44}
            height={44}
            className="hidden object-contain dark:block"
            priority
          />
        </div>
        <div>
          <div className="font-display text-lg font-bold tracking-tight">Robust</div>
          <div className="text-xs text-muted-foreground">Ad Intelligence Platform</div>
        </div>
      </div>

      <div className="my-8 max-w-md space-y-6">
        <div>
          <p className="font-ui text-xs font-bold tracking-[0.16em] text-primary uppercase">
            Built for growth teams
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,3vw,2.35rem)] font-bold leading-[1.1] tracking-tight text-foreground">
            Grow with <span className="text-primary">ads + AEO</span> in one place
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            We learn your brand upfront so automation, creative, and citation campaigns hit the
            ground running — not after weeks of manual setup.
          </p>
        </div>

        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Auto-pause losing ads and amplify winners 24/7
          </li>
          <li className="flex gap-3">
            <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Win LLM citations with GEO/AEO bounties
          </li>
          <li className="flex gap-3">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            AI creative + multi-channel publishing
          </li>
        </ul>

        <div className="flex flex-wrap gap-2">
          {[
            { Icon: Building2, label: 'Brand DNA' },
            { Icon: TrendingUp, label: 'Meta ads' },
            { Icon: Globe, label: 'AEO bounties' },
          ].map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Already have access?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
