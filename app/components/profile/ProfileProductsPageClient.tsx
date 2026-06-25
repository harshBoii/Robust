'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, Package, Plus } from 'lucide-react';

import CustomProductsSection from '@/app/components/profile/CustomProductsSection';
import {
  profileCard,
  profileCardHeader,
  profileGhostButton,
} from '@/app/components/profile/profile-utils';
import ShopProductsClient from '@/app/components/shop/ShopProductsClient';

export default function ProfileProductsPageClient() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
                Custom offerings and Shopify products for your workspace
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="glass-button-primary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Add product or service
            </button>
            <Link href="/profile" className={profileGhostButton}>
              <ChevronLeft className="h-3 w-3" />
              Profile
            </Link>
          </div>
        </div>
      </div>

      <div className={`${profileCard} min-h-0 flex-1 overflow-y-auto p-3 space-y-5`}>
        <CustomProductsSection
          createDialogOpen={createDialogOpen}
          onCreateDialogOpenChange={setCreateDialogOpen}
        />

        <div className="border-t border-border pt-4">
          <div className="mb-3">
            <h2 className="font-heading text-sm font-semibold text-foreground">Shopify products</h2>
            <p className="font-body text-[11px] text-muted-foreground">
              Products synced from your connected Shopify store
            </p>
          </div>
          <ShopProductsClient embedded />
        </div>
      </div>
    </div>
  );
}
