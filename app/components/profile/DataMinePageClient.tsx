'use client';

import Link from 'next/link';
import { ChevronLeft, Database } from 'lucide-react';

import DataMineSection from '@/app/components/profile/DataMineSection';
import {
  profileCard,
  profileCardHeader,
  profileGhostButton,
} from '@/app/components/profile/profile-utils';

export default function DataMinePageClient() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className={`${profileCard} shrink-0`}>
        <div className={profileCardHeader}>
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
          <Link href="/profile" className={`${profileGhostButton} shrink-0`}>
            <ChevronLeft className="h-3 w-3" />
            Profile
          </Link>
        </div>
      </div>

      <div className={`${profileCard} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <DataMineSection />
        </div>
      </div>
    </div>
  );
}
