import { extractHashtags, extractPostText } from "@/app/components/geo/bounty/content-metadata";

type XPreviewProps = {
  body: string;
  metadata?: unknown;
  displayName?: string;
  handle?: string;
};

export function XPreview({
  body,
  metadata,
  displayName = "Your Brand",
  handle = "yourbrand",
}: XPreviewProps) {
  const text = extractPostText(body, metadata);
  const hashtags = extractHashtags(metadata);
  const fullText = hashtags.length > 0 ? `${text}\n\n${hashtags.join(" ")}` : text;

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-background shadow-sm">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <span className="font-bold text-foreground">{displayName}</span>
                <span className="text-muted-foreground">@{handle}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">now</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {fullText || "No post content yet."}
              </p>
              <div className="mt-3 flex max-w-md justify-between text-muted-foreground">
                <span className="text-xs">💬</span>
                <span className="text-xs">🔁</span>
                <span className="text-xs">♡</span>
                <span className="text-xs">↗</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--glass-border)] px-4 py-2 text-[11px] text-muted-foreground">
          {fullText.length}/280 characters
        </div>
      </div>
    </div>
  );
}
