'use client';

import { useMemo, useState } from 'react';

import MetaAdPreviewCard from '../MetaAdPreviewCard';
import type { GroupModel } from '../types';

export default function PreviewStep({
  groups,
}: {
  groups: GroupModel[];
}) {
  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);
  const [activeAssetByGroup, setActiveAssetByGroup] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Preview</p>
        <p className="text-xs text-muted-foreground">This is a styled mock preview (not the official Meta renderer).</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {includedGroups.map((g) => {
          const activeId = activeAssetByGroup[g.bucketId] ?? g.assets[0]?.id ?? '';
          const asset = g.assets.find((a) => a.id === activeId) ?? g.assets[0];
          if (!asset) return null;

          return (
            <div key={g.bucketId} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Ad set: {g.adSetId || '—'}
                  </p>
                </div>
                {g.assets.length > 1 ? (
                  <div className="flex items-center gap-1.5">
                    {g.assets.slice(0, 6).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={[
                          'h-8 w-8 rounded-lg overflow-hidden border transition-colors',
                          a.id === activeId ? 'border-primary' : 'border-border/40 hover:border-border',
                        ].join(' ')}
                        onClick={() => setActiveAssetByGroup((prev) => ({ ...prev, [g.bucketId]: a.id }))}
                        title={a.title}
                      >
                        {a.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.thumbnailUrl} alt={a.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground/60">
                            {a.assetType}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <MetaAdPreviewCard creative={g.creative} asset={asset} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

