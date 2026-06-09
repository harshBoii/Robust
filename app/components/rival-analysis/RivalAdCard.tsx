'use client';

import { motion } from 'framer-motion';
import { Eye, Clock } from 'lucide-react';

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
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
  );
}

export default function RivalAdCard({ ad, onClick }: RivalAdCardProps) {
  const thumb = ad.thumbnailUrl ?? ad.images[0] ?? null;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="group relative w-full max-w-[148px] cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[var(--card)] shadow-sm"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900/60">
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
        <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[9px] font-bold text-white backdrop-blur-sm">
          {ad.rank}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
          <Eye className="h-4 w-4 text-white" />
          <span className="text-[10px] font-semibold text-white">View</span>
        </div>
      </div>

      {/* Bottom metadata strip */}
      <div className="space-y-1 p-2">
        {/* Status + days row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StatusDot status={ad.adStatus} />
            <span className="text-[10px] font-medium text-foreground">{ad.adStatus}</span>
          </div>
          {ad.daysRunning !== null && (
            <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              <span>{ad.daysRunning}d</span>
            </div>
          )}
        </div>

        {/* CTA chip */}
        {ad.cta && (
          <span className="inline-block max-w-full truncate rounded-full bg-[var(--sibling-primary)]/15 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--sibling-primary)]">
            {ad.cta}
          </span>
        )}
      </div>
    </motion.div>
  );
}
