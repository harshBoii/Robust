'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database } from 'lucide-react';

import { ProfileSecondaryNav } from '@/app/components/profile/ProfileSecondaryNav';
import { AiOutlineLoading } from 'react-icons/ai';

import DataMineSection from '@/app/components/profile/DataMineSection';
import { AudienceDnaTab } from '@/app/components/profile/dna/AudienceDnaTab';
import { CommunicationDnaTab } from '@/app/components/profile/dna/CommunicationDnaTab';
import { ComplianceDnaTab } from '@/app/components/profile/dna/ComplianceDnaTab';
import { DnaChipNav } from '@/app/components/profile/dna/DnaChipNav';
import { VisualDnaTab } from '@/app/components/profile/dna/VisualDnaTab';
import {
  profileCard,
  profileCardHeader,
} from '@/app/components/profile/profile-utils';
import type { DataMineSnapshot } from '@/lib/data-mine/types';
import type { DnaTabId } from '@/lib/brand-dna/types';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export default function DataMinePageClient() {
  const [activeTab, setActiveTab] = useState<DnaTabId>('overview');
  const [snapshot, setSnapshot] = useState<DataMineSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const { dataMine } = await json<{ dataMine: DataMineSnapshot }>(
        await fetch('/api/data-mine', { credentials: 'include' }),
      );
      setSnapshot(dataMine);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const brandId = snapshot?.brandEntity?.id ?? null;
  const websiteUrl = snapshot?.website;

  const dnaEmpty = (
    <div className="rounded-xl border border-border bg-muted/20 p-8 text-center">
      <p className="text-sm font-medium text-foreground">Complete your brand profile first</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Set up your brand entity in Overview before configuring Brand DNA.
      </p>
      <button
        type="button"
        onClick={() => setActiveTab('overview')}
        className="mt-4 text-sm font-medium text-primary hover:underline"
      >
        Go to Overview
      </button>
    </div>
  );

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
                Company enrichment, brand entity, offerings &amp; Brand DNA
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-3 py-2">
          <ProfileSecondaryNav />
        </div>
        <div className="border-t border-border px-3 py-2">
          <DnaChipNav active={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className={`${profileCard} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {loading && activeTab !== 'overview' ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <AiOutlineLoading className="h-5 w-5 animate-spin" />
            </div>
          ) : activeTab === 'overview' ? (
            <DataMineSection onSnapshotChange={loadSnapshot} />
          ) : !brandId ? (
            dnaEmpty
          ) : activeTab === 'visual' ? (
            <VisualDnaTab brandId={brandId} websiteUrl={websiteUrl} />
          ) : activeTab === 'communication' ? (
            <CommunicationDnaTab brandId={brandId} />
          ) : activeTab === 'audience' ? (
            <AudienceDnaTab brandId={brandId} />
          ) : activeTab === 'compliance' ? (
            <ComplianceDnaTab brandId={brandId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
