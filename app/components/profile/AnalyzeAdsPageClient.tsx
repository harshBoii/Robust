'use client';

import { Sparkles } from 'lucide-react';

import { ProfileSecondaryNav } from '@/app/components/profile/ProfileSecondaryNav';

import AnalyzeLatestAdsSection from '@/app/components/profile/AnalyzeLatestAdsSection';
import {
  profileCard,
  profileCardHeader,
} from '@/app/components/profile/profile-utils';

export default function AnalyzeAdsPageClient() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className={`${profileCard} shrink-0`}>
        <div className={profileCardHeader}>
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
                Analyze Latest Ads
              </h1>
              <p className="font-body text-[11px] text-muted-foreground">
                Run Asset Intelligence on your top winning Meta creatives
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-3 py-2">
          <ProfileSecondaryNav />
        </div>
      </div>

      <div className={`${profileCard} flex min-h-0 flex-1 flex-col`}>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <AnalyzeLatestAdsSection />
        </div>
      </div>
    </div>
  );
}
