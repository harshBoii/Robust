'use client';

/** Preview card that mimics a Google Responsive Search Ad in a SERP result. */
type Props = {
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
  /** Display name for the advertiser */
  businessName?: string;
};

export function GoogleSearchPreviewCard({
  headlines,
  descriptions,
  finalUrl,
  path1,
  path2,
  businessName,
}: Props) {
  const displayUrl = buildDisplayUrl(finalUrl, path1, path2);
  const headline = headlines.slice(0, 3).join(' | ') || 'Headline';
  const description = descriptions.slice(0, 2).join(' ') || 'Description line.';

  return (
    <div className="rounded-xl border border-border bg-card p-4 max-w-lg font-sans text-sm">
      {/* Ad badge + URL row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="rounded border border-[#70757a] px-1 py-0.5 text-[10px] font-medium text-[#70757a] leading-tight">
          Ad
        </span>
        <span className="text-[#202124] dark:text-foreground text-xs truncate">
          {businessName ? `${businessName} · ` : ''}{displayUrl}
        </span>
      </div>

      {/* Headline */}
      <p className="text-[#1a0dab] dark:text-blue-400 text-base font-medium leading-snug mb-1 line-clamp-2">
        {headline}
      </p>

      {/* Description */}
      <p className="text-[#4d5156] dark:text-muted-foreground text-xs leading-relaxed line-clamp-2">
        {description}
      </p>

      {/* All headlines preview */}
      {headlines.length > 3 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          +{headlines.length - 3} more headline{headlines.length - 3 > 1 ? 's' : ''} (Google rotates)
        </p>
      )}
    </div>
  );
}

function buildDisplayUrl(finalUrl: string, path1?: string, path2?: string): string {
  try {
    const u = new URL(finalUrl);
    let display = u.hostname.replace(/^www\./, '');
    if (path1) display += '/' + path1;
    if (path2) display += '/' + path2;
    return display;
  } catch {
    return finalUrl;
  }
}
