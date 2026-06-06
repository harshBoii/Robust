'use client';

/** Preview card for a Google Performance Max campaign asset group. */
type Props = {
  headlines: string[];
  longHeadline?: string;
  descriptions: string[];
  businessName?: string;
  finalUrl: string;
  imageUrls?: string[];
};

export function GooglePmaxPreviewCard({
  headlines,
  longHeadline,
  descriptions,
  businessName,
  finalUrl,
  imageUrls = [],
}: Props) {
  const headline = longHeadline || headlines[0] || 'Headline';
  const description = descriptions[0] || 'Description text here.';

  let displayUrl = finalUrl;
  try {
    displayUrl = new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {/* keep original */}

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden max-w-sm font-sans text-sm shadow-sm">
      {/* Image grid */}
      <div className="grid grid-cols-2 h-32 gap-0.5 bg-muted">
        {imageUrls.slice(0, 4).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="w-full h-full object-cover" />
        ))}
        {imageUrls.length === 0 && (
          <div className="col-span-2 flex items-center justify-center h-full text-muted-foreground text-xs">
            No images yet
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-[#70757a] px-1 py-0.5 text-[10px] font-medium text-muted-foreground leading-tight">
            Ad · PMax
          </span>
          <span className="text-[10px] text-blue-500 truncate">{displayUrl}</span>
        </div>
        <p className="font-semibold text-foreground text-sm line-clamp-2">{headline}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        {businessName && (
          <p className="text-[10px] text-muted-foreground font-medium pt-0.5">{businessName}</p>
        )}
      </div>

      {/* Asset summary */}
      <div className="border-t border-border px-3 py-2 flex gap-4 text-[11px] text-muted-foreground">
        <span>{headlines.length} headline{headlines.length !== 1 ? 's' : ''}</span>
        <span>{descriptions.length} description{descriptions.length !== 1 ? 's' : ''}</span>
        <span>{imageUrls.length} image{imageUrls.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
