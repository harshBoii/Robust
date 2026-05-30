import { extractHashtags, extractPostText, metadataString, parseContentMetadata } from "@/app/components/geo/bounty/content-metadata";

type RedditPreviewProps = {
  title: string | null;
  body: string;
  metadata?: unknown;
  authorName?: string;
};

export function RedditPreview({ title, body, metadata, authorName = "your_brand" }: RedditPreviewProps) {
  const meta = parseContentMetadata(metadata);
  const text = extractPostText(body, metadata);
  const pageMeta =
    meta.page && typeof meta.page === "object" && !Array.isArray(meta.page)
      ? (meta.page as Record<string, unknown>)
      : null;
  const subreddit =
    metadataString(meta, "subreddit") ??
    (pageMeta ? metadataString(pageMeta, "subreddit") : null) ??
    "r/yourbrand";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-md border border-[#343536] bg-[#1a1a1b] text-[#d7dadc] shadow-lg">
        <div className="flex">
          <div className="flex w-10 shrink-0 flex-col items-center gap-1 bg-[#161617] py-3">
            <svg className="h-5 w-5 text-[#818384] hover:text-[#ff4500]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3.5 6 7.5h2.5V14h3V7.5H14L10 3.5z" />
            </svg>
            <span className="text-xs font-bold text-[#d7dadc]">Vote</span>
            <svg className="h-5 w-5 text-[#818384] hover:text-[#7193ff]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 16.5 14 12.5h-2.5V6h-3v6.5H6l4 4z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#ff4500] text-[10px] font-bold text-white">
                r
              </span>
              <span className="font-bold text-[#d7dadc]">{subreddit}</span>
              <span className="text-[#818384]">•</span>
              <span className="text-[#818384]">Posted by u/{authorName}</span>
              <span className="text-[#818384]">• just now</span>
            </div>

            <h2 className="mb-2 text-lg font-medium leading-snug text-[#d7dadc]">
              {title || "Post title"}
            </h2>

            <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#d7dadc]/95">
              {text || "No post content yet."}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-[#818384]">
              <span className="inline-flex items-center gap-1.5">
                <span>💬</span> 0 Comments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span>↗</span> Share
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span>🔖</span> Save
              </span>
            </div>
          </div>
        </div>
      </div>
      {extractHashtags(metadata).length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tags: {extractHashtags(metadata).join(" ")}
        </p>
      )}
    </div>
  );
}
