'use client';

import Link from 'next/link';
import { ChevronLeft, Database } from 'lucide-react';

import DataMineSection from '@/app/components/profile/DataMineSection';

const profileCard =
  'overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

export default function DataMinePageClient() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className={`${profileCard} shrink-0`}>
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Database className="h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
                Data Mine
              </h1>
              <p className="font-body text-[11px] text-muted-foreground">
                Company enrichment, brand entity, and offerings
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" />
            Profile
          </Link>
        </div>
      </div>

      <div className={`${profileCard} flex min-h-0 flex-1 flex-col`}>
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
          <DataMineSection />
        </div>
      </div>
    </div>
  );
}
