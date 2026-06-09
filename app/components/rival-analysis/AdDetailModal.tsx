'use client';

import { X, Calendar, Hash, MousePointerClick, Image as ImageIcon, Play, Link2, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { ModalBackdrop } from '@/app/components/common/ModalBackdrop';
import { ModalPortal } from '@/app/components/common/ModalPortal';
import type { RivalAdCardData } from './RivalAdCard';

interface AdDetailModalProps {
  ad: RivalAdCardData | null;
  onClose: () => void;
}

export default function AdDetailModal({ ad, onClose }: AdDetailModalProps) {
  if (!ad) return null;

  const thumb = ad.thumbnailUrl ?? ad.images[0] ?? null;

  return (
    <ModalPortal open>
      <ModalBackdrop onClose={onClose} contentClassName="!max-w-5xl w-full">
        <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--card)] shadow-2xl md:flex-row">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>

          {/* LEFT — thumbnail + metadata */}
          <div className="flex w-full shrink-0 flex-col md:w-72">
            {/* Image */}
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="Ad creative" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No image
                </div>
              )}
              {/* Rank badge */}
              <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white">
                #{ad.rank}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-3 overflow-y-auto p-4">
              <MetaRow icon={<Hash className="h-3.5 w-3.5" />} label="Library ID" value={ad.libraryId} />
              {ad.startDate && (
                <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Started" value={ad.startDate} />
              )}
              {ad.daysRunning !== null && (
                <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Running" value={`${ad.daysRunning} days`} />
              )}
              {ad.cta && (
                <MetaRow icon={<MousePointerClick className="h-3.5 w-3.5" />} label="CTA" value={ad.cta} />
              )}
              <MetaRow
                icon={<ImageIcon className="h-3.5 w-3.5" />}
                label="Images"
                value={String(ad.images.length)}
              />
              <MetaRow
                icon={ad.imageVisible ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5" />}
                label="Vision"
                value={ad.imageVisible ? 'Analyzed' : 'No image'}
              />

              {ad.landingUrls.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Link2 className="h-3 w-3" /> Landing URLs
                  </p>
                  <div className="space-y-1">
                    {ad.landingUrls.slice(0, 5).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-[10px] text-[var(--sibling-primary)] hover:underline"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos count */}
              {Array.isArray(ad.images) && (
                <MetaRow
                  icon={<Play className="h-3.5 w-3.5" />}
                  label="Videos"
                  value="—"
                />
              )}
            </div>
          </div>

          {/* RIGHT — analysis */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/10 md:border-l md:border-t-0">
            <div className="shrink-0 border-b border-white/10 px-5 py-3">
              <h3 className="font-heading text-sm font-semibold text-foreground">Ad Analysis</h3>
              <p className="text-[11px] text-muted-foreground">GPT-4 Vision competitive intelligence</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {ad.analysis ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="mb-2 mt-4 text-sm font-bold first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-1.5 mt-3 text-xs font-semibold text-[var(--sibling-primary)]">{children}</h2>,
                      p: ({ children }) => <p className="mb-2 text-sm leading-relaxed text-foreground/90">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 text-sm">{children}</ul>,
                      li: ({ children }) => <li className="leading-snug text-foreground/80">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    }}
                  >
                    {ad.analysis}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Analysis not yet available.</p>
              )}
            </div>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-[60px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}
