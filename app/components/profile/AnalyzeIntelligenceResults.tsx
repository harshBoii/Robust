'use client';

import Image from 'next/image';
import { Film, ImageIcon } from 'lucide-react';

import type { IntelligenceResultRow } from '@/lib/asset-intelligence/intelligence-results';

function TagList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((t) => (
          <span
            key={t}
            className="rounded-md bg-violet-500/10 px-1.5 py-0.5 font-body text-[10px] text-violet-800"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function insightsList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object' && 'text' in x && typeof (x as { text: unknown }).text === 'string') {
        return (x as { text: string }).text;
      }
      if (x && typeof x === 'object' && 'insight' in x && typeof (x as { insight: unknown }).insight === 'string') {
        return (x as { insight: string }).insight;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s));
}

function MediaPreview({ row }: { row: IntelligenceResultRow }) {
  const isVideo = row.assetType === 'VIDEO';
  const poster = row.thumbnailUrl;

  if (isVideo && row.playbackUrl) {
    return (
      <video
        src={row.playbackUrl}
        poster={poster ?? undefined}
        controls
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }

  if (poster) {
    return (
      <Image
        src={poster}
        alt=""
        fill
        sizes="160px"
        className="object-cover"
        unoptimized
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground">
      {isVideo ? <Film className="h-6 w-6 opacity-40" /> : <ImageIcon className="h-6 w-6 opacity-40" />}
      <span className="font-body text-[10px]">{row.assetType}</span>
    </div>
  );
}

function IntelligenceCard({ row }: { row: IntelligenceResultRow }) {
  const intel = row.intelligence;
  const insights = intel ? insightsList(intel.missRobustaInsights) : [];

  return (
    <article className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:gap-4">
        <div className="relative mx-auto h-36 w-full shrink-0 overflow-hidden rounded-lg border border-black/[0.06] bg-muted/30 sm:mx-0 sm:h-32 sm:w-36">
          <MediaPreview row={row} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground line-clamp-2">
              {row.adName ?? row.title}
            </h3>
            {row.metaAdId ? (
              <p className="font-data mt-0.5 truncate text-[10px] text-muted-foreground">{row.metaAdId}</p>
            ) : null}
            <p className="font-body mt-1 text-[11px] text-muted-foreground">
              Gallery: {row.title} · {row.assetType}
              {row.intelligenceStatus === 'READY' ? (
                <span className="ml-1.5 text-emerald-600">· Intelligence ready</span>
              ) : (
                <span className="ml-1.5">· {row.intelligenceStatus}</span>
              )}
            </p>
          </div>

          {!intel ? (
            <p className="font-body text-[12px] text-muted-foreground">
              No intelligence saved yet for this asset.
            </p>
          ) : (
            <div className="space-y-2.5">
              {intel.titlePrimary ? (
                <p className="font-body text-[13px] font-medium text-foreground">{intel.titlePrimary}</p>
              ) : null}
              {intel.shortSummary ? (
                <p className="font-body text-[12px] leading-relaxed text-foreground/90">
                  {intel.shortSummary}
                </p>
              ) : null}
              {intel.longDescription ? (
                <p className="font-body text-[11px] leading-relaxed text-muted-foreground line-clamp-4">
                  {intel.longDescription}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {intel.theme ? <span>Theme: {intel.theme}</span> : null}
                {intel.sentiment ? <span>· {intel.sentiment}</span> : null}
                {intel.contentType ? <span>· {intel.contentType}</span> : null}
                {typeof intel.confidence === 'number' ? (
                  <span>· {Math.round(intel.confidence * 100)}% confidence</span>
                ) : null}
              </div>

              <TagList label="Tags" items={intel.tags} />
              <TagList label="Topics" items={intel.topics} />
              <TagList label="Tone" items={intel.tone} />
              <TagList label="Audience" items={intel.targetAudience} />
              <TagList label="Best platforms" items={intel.bestPlatforms} />

              {insights.length > 0 ? (
                <div>
                  <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Miss Robusta insights
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {insights.map((line, i) => (
                      <li key={i} className="font-body text-[11px] leading-snug text-foreground/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

type Props = {
  results: IntelligenceResultRow[];
  loading?: boolean;
};

export default function AnalyzeIntelligenceResults({ results, loading }: Props) {
  if (loading) {
    return (
      <p className="font-body text-[11px] text-muted-foreground">Loading intelligence results…</p>
    );
  }

  if (!results.length) return null;

  return (
    <section className="mt-4 space-y-3 border-t border-black/[0.06] pt-4">
      <h2 className="font-heading text-sm font-semibold text-foreground">Media & intelligence</h2>
      <p className="font-body text-[11px] text-muted-foreground">
        Creatives analyzed and intelligence stored for your winning ads.
      </p>
      <div className="space-y-3">
        {results.map((row) => (
          <IntelligenceCard key={row.assetId} row={row} />
        ))}
      </div>
    </section>
  );
}
