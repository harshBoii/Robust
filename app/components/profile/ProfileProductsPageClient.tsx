'use client';

import Link from 'next/link';
import { ChevronLeft, Package } from 'lucide-react';

import {
  profileCard,
  profileCardHeader,
  profileGhostButton,
} from '@/app/components/profile/profile-utils';
import ShopProductsClient from '@/app/components/shop/ShopProductsClient';

export default function ProfileProductsPageClient() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-hidden">
      <div className={`${profileCard} shrink-0`}>
        <div className={profileCardHeader}>
          <div className="flex min-w-0 items-center gap-2">
            <Package className="h-4 w-4 shrink-0 text-violet-600" />
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold leading-tight text-foreground">
                Products
              </h1>
              <p className="font-body text-[11px] text-muted-foreground">
                Shopify products synced to your workspace
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
        <ShopProductsClient embedded />
      </div>
    </div>
  );
}
