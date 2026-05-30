"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { platformLabel } from "@/lib/geo/bounty/spread-platforms";
import { LinkedInPreview } from "@/app/components/geo/bounty/platform-previews/linkedin-preview";
import { RedditPreview } from "@/app/components/geo/bounty/platform-previews/reddit-preview";
import { ThirdPartyBlogPreview } from "@/app/components/geo/bounty/platform-previews/third-party-blog-preview";
import { XPreview } from "@/app/components/geo/bounty/platform-previews/x-preview";

type BountyContentRow = {
  id: string;
  platform: BountySpreadPlatform;
  status: string;
  title: string | null;
  body: string;
  metadata?: unknown;
};

type ContentTab = BountySpreadPlatform;

type HuntContentExplorerProps = {
  bountyId: string;
  query: string;
  hasBlog: boolean;
  blogTitle?: string | null;
  blogMarkdown?: string;
  blogChildren?: ReactNode;
  activeTab: ContentTab;
  onTabChange: (tab: ContentTab) => void;
};

function statusChipClass(status: string) {
  const s = status.toUpperCase();
  if (s === "PUBLISHED") return "text-emerald-600 dark:text-emerald-400";
  if (s === "FAILED") return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

export function HuntContentExplorer({
  bountyId,
  query,
  hasBlog,
  blogTitle,
  blogMarkdown,
  blogChildren,
  activeTab,
  onTabChange,
}: HuntContentExplorerProps) {
  const [contents, setContents] = useState<BountyContentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const contentRes = await fetch(`/api/geo/bounty/${encodeURIComponent(bountyId)}/content`, {
        credentials: "include",
      });
      const contentJson = await contentRes.json().catch(() => null);
      if (contentRes.ok && contentJson?.success) {
        setContents((contentJson.data?.contents ?? []) as BountyContentRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tabs = useMemo(() => {
    const items: ContentTab[] = [];
    if (hasBlog) items.push("WEBSITE_BLOG");
    for (const row of contents) {
      if (!items.includes(row.platform)) items.push(row.platform);
    }
    return items;
  }, [hasBlog, contents]);

  useEffect(() => {
    if (tabs.length === 0) return;
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#content-", "") : "";
    if (hash && tabs.includes(hash as ContentTab) && hash !== activeTab) {
      onTabChange(hash as ContentTab);
    }
  }, [tabs, activeTab, onTabChange]);

  const activeSocial = contents.find((c) => c.platform === activeTab);

  if (loading && tabs.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Loading content previews…</p>;
  }

  if (tabs.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">
          Preview
        </p>
        {tabs.map((tab) => {
          const social = contents.find((c) => c.platform === tab);
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              id={`content-${tab}`}
              onClick={() => {
                onTabChange(tab);
                window.history.replaceState(null, "", `#content-${tab}`);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "border-[var(--sibling-primary)] bg-[var(--sibling-primary)]/15 text-[var(--sibling-primary)]"
                  : "border-[var(--glass-border)] bg-[var(--glass)]/60 text-muted-foreground hover:text-foreground hover:border-[var(--sibling-primary)]/40"
              }`}
            >
              {platformLabel(tab)}
              {social && (
                <span className={`text-[10px] font-medium capitalize ${statusChipClass(social.status)}`}>
                  · {social.status.toLowerCase()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "WEBSITE_BLOG" && hasBlog ? (
        <div className="space-y-6">
          <header className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--sibling-accent)] mb-3">
              Website (Blogs)
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground font-heading leading-[1.1] mb-3">
              {blogTitle ?? "Blog article"}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">{query}</p>
          </header>
          {blogChildren ?? (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/30 p-7 sm:p-10">
              <p className="whitespace-pre-wrap text-muted-foreground">{blogMarkdown ?? ""}</p>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "REDDIT" && activeSocial && (
        <RedditPreview
          title={activeSocial.title}
          body={activeSocial.body}
          metadata={activeSocial.metadata}
        />
      )}

      {activeTab === "X" && activeSocial && (
        <XPreview body={activeSocial.body} metadata={activeSocial.metadata} />
      )}

      {activeTab === "LINKEDIN" && activeSocial && (
        <LinkedInPreview body={activeSocial.body} metadata={activeSocial.metadata} />
      )}

      {activeTab === "THIRD_PARTY_BLOG" && activeSocial && (
        <ThirdPartyBlogPreview
          title={activeSocial.title}
          body={activeSocial.body}
          metadata={activeSocial.metadata}
        />
      )}
    </section>
  );
}
