import { extractPostText } from "@/app/components/geo/bounty/content-metadata";

type ThirdPartyBlogPreviewProps = {
  title: string | null;
  body: string;
  metadata?: unknown;
  siteName?: string;
};

export function ThirdPartyBlogPreview({
  title,
  body,
  metadata,
  siteName = "Guest Blog",
}: ThirdPartyBlogPreviewProps) {
  const text = extractPostText(body, metadata);

  return (
    <div className="mx-auto max-w-3xl">
      <article className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/40 shadow-sm">
        <div className="border-b border-[var(--glass-border)] px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {siteName}
        </div>
        <div className="px-6 py-8 sm:px-10">
          <h1 className="text-3xl font-bold leading-tight text-foreground">
            {title || "Article title"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Published on third-party blog · Draft preview</p>
          <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
            {text || "No article content yet."}
          </div>
        </div>
      </article>
    </div>
  );
}
