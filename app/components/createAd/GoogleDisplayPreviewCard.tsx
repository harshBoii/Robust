'use client';

/** Preview card mimicking a Google Responsive Display Ad. */
type Props = {
  headlines: string[];
  longHeadline?: string;
  descriptions: string[];
  businessName?: string;
  finalUrl: string;
  imageUrl?: string | null;
};

export function GoogleDisplayPreviewCard({
  headlines,
  longHeadline,
  descriptions,
  businessName,
  finalUrl,
  imageUrl,
}: Props) {
  const headline = longHeadline || headlines[0] || 'Headline';
  const description = descriptions[0] || 'Description text here.';

  let displayUrl = finalUrl;
  try {
    displayUrl = new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {/* keep original */}

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-sm font-sans text-sm shadow-sm">
      {/* Image area */}
      <div className="relative h-36 bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Ad image" className="w-full h-full object-cover" />
        ) : (
          <span className="text-muted-foreground text-xs">Image placeholder</span>
        )}
        <span className="absolute top-2 left-2 rounded border border-[#70757a] px-1 py-0.5 text-[10px] font-medium text-white bg-black/40 leading-tight">
          Ad
        </span>
      </div>

      {/* Content area */}
      <div className="p-3 space-y-1">
        <p className="font-semibold text-foreground text-sm line-clamp-2">{headline}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        <div className="flex items-center justify-between pt-1">
          {businessName && (
            <span className="text-[10px] text-muted-foreground font-medium">{businessName}</span>
          )}
          <span className="text-[10px] text-blue-500 truncate">{displayUrl}</span>
        </div>
      </div>
    </div>
  );
}
