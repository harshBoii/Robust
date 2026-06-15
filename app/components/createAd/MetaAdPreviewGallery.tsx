'use client';

import MetaAdPreviewCard from './MetaAdPreviewCard';
import type { Asset, CreativeFields, GroupModel } from './types';

export function parseAdPreviewGroups(payload: unknown): GroupModel[] {
  const groups = (payload as { groups?: GroupModel[] } | null)?.groups;
  if (!Array.isArray(groups)) return [];
  return groups.filter((g) => g.included && g.assets?.[0]);
}

export function adPreviewGroupsHaveMedia(groups: GroupModel[]): boolean {
  return groups.some((g) => g.included && Boolean(g.assets[0]));
}

export default function MetaAdPreviewGallery({
  groups,
  pageName = 'Your Page',
  className = '',
}: {
  groups: GroupModel[];
  pageName?: string;
  className?: string;
}) {
  const included = groups.filter((g) => g.included && g.assets[0]);

  if (!included.length) return null;

  return (
    <div className={`grid gap-3 lg:grid-cols-2 ${className}`.trim()}>
      {included.map((g) => {
        const asset = g.assets[0]!;
        return (
          <div key={g.bucketId} className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{g.label}</p>
            <MetaAdPreviewCard creative={g.creative} asset={asset} pageName={pageName} />
          </div>
        );
      })}
    </div>
  );
}

export function MetaAdPreviewSingle({
  creative,
  asset,
  label,
  pageName = 'Your Page',
}: {
  creative: CreativeFields;
  asset: Asset;
  label?: string;
  pageName?: string;
}) {
  return (
    <div className="space-y-1">
      {label ? <p className="text-xs font-semibold text-foreground">{label}</p> : null}
      <MetaAdPreviewCard creative={creative} asset={asset} pageName={pageName} />
    </div>
  );
}
