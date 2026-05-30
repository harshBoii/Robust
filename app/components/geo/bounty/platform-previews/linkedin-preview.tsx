import { extractHashtags, extractPostText } from "@/app/components/geo/bounty/content-metadata";

type LinkedInPreviewProps = {
  body: string;
  metadata?: unknown;
  displayName?: string;
  headline?: string;
};

export function LinkedInPreview({
  body,
  metadata,
  displayName = "Your Brand",
  headline = "Company · Marketing",
}: LinkedInPreviewProps) {
  const text = extractPostText(body, metadata);
  const hashtags = extractHashtags(metadata);

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-lg border border-[#e0e0e0] bg-white text-[#000000e6] shadow-md dark:border-[#38434f] dark:bg-[#1b1f23] dark:text-[#ffffffe6]">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-base font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{displayName}</p>
              <p className="text-xs text-[#00000099] dark:text-[#ffffff99]">{headline}</p>
              <p className="mt-0.5 text-xs text-[#00000099] dark:text-[#ffffff99]">Just now · 🌐</p>
            </div>
          </div>

          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {text || "No post content yet."}
          </div>

          {hashtags.length > 0 && (
            <p className="mt-3 text-sm text-[#0a66c2]">{hashtags.join(" ")}</p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[#e0e0e0] pt-2 text-xs text-[#00000099] dark:border-[#38434f] dark:text-[#ffffff99]">
            <span>👍 Like</span>
            <span>💬 Comment</span>
            <span>🔁 Repost</span>
            <span>↗ Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
