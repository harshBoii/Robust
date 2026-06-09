'use client';

import { motion } from 'framer-motion';
import { Eye, Clock, ExternalLink } from 'lucide-react';

export interface RivalAdCardData {
  id: string;
  libraryId: string;
  startDate: string | null;
  adStatus: string;
  cta: string | null;
  daysRunning: number | null;
  thumbnailUrl: string | null;
  images: string[];
  analysis: string | null;
  imageVisible: boolean;
  rank: number;
  landingUrls: string[];
}

interface RivalAdCardProps {
  ad: RivalAdCardData;
  onClick: () => void;
}

function StatusDot({ status }: { status: string }) {
  const active = status === 'Active';
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
  );
}

export default function RivalAdCard({ ad, onClick }: RivalAdCardProps) {
  const thumb = ad.thumbnailUrl ?? ad.images[0] ?? null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[var(--card)] shadow-md"
    >
      {/* Square image area */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-900/60">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={`Ad ${ad.libraryId}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs text-muted-foreground">No image</span>
          </div>
        )}

        {/* Rank badge */}
        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white backdrop-blur-sm">
          {ad.rank}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
          <Eye className="h-6 w-6 text-white" />
          <span className="text-xs font-semibold text-white">View Analysis</span>
        </div>
      </div>

      {/* Bottom metadata strip */}
      <div className="space-y-2 p-3">
        {/* Status + days row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={ad.adStatus} />
            <span className="text-xs font-medium text-foreground">{ad.adStatus}</span>
          </div>
          {ad.daysRunning !== null && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{ad.daysRunning}d running</span>
            </div>
          )}
        </div>

        {/* CTA chip */}
        {ad.cta && (
          <span className="inline-block rounded-full bg-[var(--sibling-primary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--sibling-primary)]">
            {ad.cta}
          </span>
        )}

        {/* Landing URL quick link */}
        {ad.landingUrls[0] && (
          <a
            href={ad.landingUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-[var(--sibling-primary)] truncate"
          >
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{ad.landingUrls[0]}</span>
          </a>
        )}
      </div>
    </motion.div>
  );
}
