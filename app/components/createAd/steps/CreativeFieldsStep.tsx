'use client';

import { useMemo } from 'react';

import type { CreativeFields, GroupModel } from '../types';

const CTA_TYPES = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'DOWNLOAD',
  'GET_QUOTE',
  'CONTACT_US',
  'BOOK_TRAVEL',
  'SUBSCRIBE',
] as const;

function isValidUrl(v: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export default function CreativeFieldsStep({
  groups,
  onChangeCreative,
  onCopyFromPrevious,
}: {
  groups: GroupModel[];
  onChangeCreative: (bucketId: string, patch: Partial<CreativeFields>) => void;
  onCopyFromPrevious: (bucketId: string) => void;
}) {
  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Creative fields</p>
        <p className="text-xs text-muted-foreground">Fill in ad creative fields for each group.</p>
      </div>

      <div className="space-y-3">
        {includedGroups.map((g, idx) => {
          const urlOk = !g.creative.landingUrl.trim() || isValidUrl(g.creative.landingUrl.trim());
          return (
            <details key={g.bucketId} className="rounded-2xl border border-border/40 bg-background/20 overflow-hidden" open={idx === 0}>
              <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.assets.length} asset{g.assets.length !== 1 ? 's' : ''} · {g.adSetId ? 'Ad set mapped' : 'No ad set yet'}
                  </p>
                </div>
                <button
                  type="button"
                  className="glass-button px-3 py-2 text-xs"
                  onClick={(e) => { e.preventDefault(); onCopyFromPrevious(g.bucketId); }}
                  disabled={idx === 0}
                  title={idx === 0 ? 'Nothing to copy yet' : 'Copy fields from previous group'}
                >
                  Copy previous
                </button>
              </summary>

              <div className="p-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Headline
                  </label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    value={g.creative.headline}
                    maxLength={255}
                    onChange={(e) => onChangeCreative(g.bucketId, { headline: e.target.value })}
                    placeholder="Your headline"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Primary text
                  </label>
                  <textarea
                    className="glass-input w-full px-3 py-2.5 text-sm min-h-[90px]"
                    value={g.creative.primaryText}
                    onChange={(e) => onChangeCreative(g.bucketId, { primaryText: e.target.value })}
                    placeholder="What do you want people to know?"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Description (optional)
                  </label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    value={g.creative.description}
                    onChange={(e) => onChangeCreative(g.bucketId, { description: e.target.value })}
                    placeholder="Short supporting line"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Landing URL
                  </label>
                  <input
                    className={[
                      'glass-input w-full px-3 py-2.5 text-sm',
                      urlOk ? '' : 'ring-1 ring-destructive/50 border-destructive/30',
                    ].join(' ')}
                    value={g.creative.landingUrl}
                    onChange={(e) => onChangeCreative(g.bucketId, { landingUrl: e.target.value })}
                    placeholder="https://example.com"
                  />
                  {!urlOk ? (
                    <p className="mt-1 text-[11px] text-destructive">Please enter a valid URL.</p>
                  ) : null}
                </div>

                <div>
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    CTA type
                  </label>
                  <select
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    value={g.creative.ctaType}
                    onChange={(e) => onChangeCreative(g.bucketId, { ctaType: e.target.value })}
                  >
                    {CTA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-ui mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Pixel ID override (optional)
                  </label>
                  <input
                    className="glass-input w-full px-3 py-2.5 text-sm"
                    value={g.creative.pixelId}
                    onChange={(e) => onChangeCreative(g.bucketId, { pixelId: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

