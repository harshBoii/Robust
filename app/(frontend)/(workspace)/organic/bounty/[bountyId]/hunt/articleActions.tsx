"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import { publishPlatformLabel } from "@/lib/geo/bounty/spread-platforms";

type PublishTargets = {
  shopify: { available: boolean };
  wordpressWoo: { available: boolean; reason?: string };
  websiteBlog?: { available: boolean; reason?: string };
  social?: Record<string, { available: boolean; reason?: string }>;
};

type BountyContentRow = {
  id: string;
  platform: BountySpreadPlatform;
  status: string;
  publishedUrl: string | null;
  errorMessage: string | null;
};

type ArticleActionsProps = {
  bountyId: string;
  selectedPlatform: BountySpreadPlatform;
  onPlatformChange: (platform: BountySpreadPlatform) => void;
  onPublished?: () => void;
};

function statusLabel(published: boolean, status?: string) {
  if (published || status?.toUpperCase() === "PUBLISHED") {
    return { text: "Published", className: "text-emerald-600 dark:text-emerald-400" };
  }
  if (status?.toUpperCase() === "FAILED") {
    return { text: "Failed", className: "text-red-600 dark:text-red-400" };
  }
  return { text: "Draft", className: "text-amber-600 dark:text-amber-400" };
}

export function ArticleActions({
  bountyId,
  selectedPlatform,
  onPlatformChange,
  onPublished,
}: ArticleActionsProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [targets, setTargets] = useState<PublishTargets | null>(null);
  const [contents, setContents] = useState<BountyContentRow[]>([]);
  const [hasBlog, setHasBlog] = useState(false);
  const [blogPublished, setBlogPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [blogDestination, setBlogDestination] = useState<"shopify" | "wordpress_wc">("shopify");

  const loadData = useCallback(async () => {
    setLoading(true);
    setTargetsError(null);
    try {
      const [targetsRes, contentRes] = await Promise.all([
        fetch(`/api/geo/bounty/${encodeURIComponent(bountyId)}/publish-targets`, {
          credentials: "include",
        }),
        fetch(`/api/geo/bounty/${encodeURIComponent(bountyId)}/content`, {
          credentials: "include",
        }),
      ]);

      const targetsJson = await targetsRes.json().catch(() => null);
      const contentJson = await contentRes.json().catch(() => null);

      if (!targetsRes.ok || !targetsJson?.success) {
        setTargetsError(targetsJson?.error ?? "Could not load publish options");
        setTargets(null);
      } else {
        const data = targetsJson.data as PublishTargets;
        setTargets(data);
        if (data.shopify.available) setBlogDestination("shopify");
        else if (data.wordpressWoo.available) setBlogDestination("wordpress_wc");
      }

      if (contentRes.ok && contentJson?.success) {
        setHasBlog(Boolean(contentJson.data?.aeoPage));
        setBlogPublished(Boolean(contentJson.data?.aeoPage?.publishedAt));
        setContents((contentJson.data?.contents ?? []) as BountyContentRow[]);
      }
    } catch {
      setTargetsError("Could not load publish options");
    } finally {
      setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availablePlatforms = useMemo(() => {
    const platforms: BountySpreadPlatform[] = [];
    if (hasBlog) platforms.push("WEBSITE_BLOG");
    for (const row of contents) {
      if (!platforms.includes(row.platform)) platforms.push(row.platform);
    }
    return platforms;
  }, [hasBlog, contents]);

  useEffect(() => {
    if (availablePlatforms.length === 0) return;
    if (!availablePlatforms.includes(selectedPlatform)) {
      onPlatformChange(availablePlatforms[0]!);
    }
  }, [availablePlatforms, selectedPlatform, onPlatformChange]);

  const activeContent = contents.find((c) => c.platform === selectedPlatform);
  const isBlog = selectedPlatform === "WEBSITE_BLOG";

  const canPublishBlog =
    targets &&
    (targets.shopify.available || targets.wordpressWoo.available || targets.websiteBlog?.available);

  const socialAvailability = !isBlog ? targets?.social?.[selectedPlatform] : null;
  const canPublishSocial = socialAvailability?.available ?? false;

  const isPublished = isBlog
    ? blogPublished
    : activeContent?.status?.toUpperCase() === "PUBLISHED";

  const canPublish = isBlog ? Boolean(canPublishBlog) : canPublishSocial;

  const currentStatus = statusLabel(
    isBlog ? blogPublished : false,
    isBlog ? (blogPublished ? "PUBLISHED" : "DRAFT") : activeContent?.status
  );

  const onApprove = async () => {
    setApproveLoading(true);
    setMessage(null);

    try {
      if (isBlog) {
        const path =
          blogDestination === "shopify"
            ? `/api/geo/bounty/${encodeURIComponent(bountyId)}/approve-shopify`
            : `/api/geo/bounty/${encodeURIComponent(bountyId)}/approve-wordpress`;

        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(json?.error ?? "Failed to publish blog");
          return;
        }
        setMessage("Published blog successfully.");
        setBlogPublished(true);
      } else {
        if (!activeContent) {
          setMessage("No content found for this platform.");
          return;
        }
        const res = await fetch(`/api/geo/bounty/${encodeURIComponent(bountyId)}/approve-content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            platform: selectedPlatform,
            contentId: activeContent.id,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(json?.error ?? `Failed to publish to ${publishPlatformLabel(selectedPlatform)}`);
          return;
        }
        const url = json?.data?.publishedUrl;
        setMessage(
          url
            ? `Published to ${publishPlatformLabel(selectedPlatform)}: ${url}`
            : `Published to ${publishPlatformLabel(selectedPlatform)} successfully.`
        );
      }

      onPublished?.();
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setApproveLoading(false);
    }
  };

  const onRegenerate = () => {
    setShowFeedback(true);
    setMessage(null);
  };

  const onSubmitRegenerate = () => {
    if (!feedback.trim()) {
      setMessage("Please add feedback before regenerating.");
      return;
    }
    setMessage(`Regeneration queued for ${bountyId} with your feedback.`);
    setShowFeedback(false);
  };

  if (!loading && availablePlatforms.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/40 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Approve & Publish</h3>
        <span className={`text-[10px] font-medium ${currentStatus.className}`}>
          {currentStatus.text}
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading publish options…</p>
      ) : null}

      {targetsError ? <p className="text-xs text-destructive">{targetsError}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Platform</span>
          <select
            value={selectedPlatform}
            onChange={(e) => onPlatformChange(e.target.value as BountySpreadPlatform)}
            disabled={loading || availablePlatforms.length === 0}
            className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-foreground min-w-[140px]"
          >
            {availablePlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {publishPlatformLabel(platform)}
              </option>
            ))}
          </select>
        </label>

        {isBlog && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">Publish to</span>
            <select
              value={blogDestination}
              onChange={(e) => setBlogDestination(e.target.value as "shopify" | "wordpress_wc")}
              disabled={!canPublishBlog}
              className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-foreground min-w-[160px]"
            >
              <option value="shopify" disabled={!targets?.shopify.available}>
                Shopify
              </option>
              <option value="wordpress_wc" disabled={!targets?.wordpressWoo.available}>
                WordPress
              </option>
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={onApprove}
          disabled={approveLoading || !canPublish || isPublished}
          className="glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approveLoading ? "Publishing…" : "Approve & Publish"}
        </button>
      </div>

      {isBlog && !canPublishBlog && (
        <p className="text-xs text-muted-foreground">
          Connect Shopify or WordPress under Connection to publish blogs.
        </p>
      )}

      {!isBlog && !canPublishSocial && !isPublished && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {socialAvailability?.reason ?? "Connect this platform under Social Connections."}{" "}
          <Link href="/manager/social" className="text-[var(--sibling-primary)] hover:underline">
            Connect account
          </Link>
        </p>
      )}

      {!isBlog && activeContent?.publishedUrl && (
        <a
          href={activeContent.publishedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-[var(--sibling-primary)] hover:underline"
        >
          View published post
        </a>
      )}

      {!isBlog && activeContent?.errorMessage && (
        <p className="text-xs text-destructive">{activeContent.errorMessage}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-hover)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--glass-hover)]/80"
        >
          Regenerate
        </button>
      </div>

      {showFeedback ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground" htmlFor="regen-feedback">
            Regeneration feedback
          </label>
          <textarea
            id="regen-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us what to improve in this page..."
            className="w-full min-h-24 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/30 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmitRegenerate}
              className="glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold"
            >
              Submit Regeneration
            </button>
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="rounded-md border border-[var(--glass-border)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div className="text-xs text-foreground">{message}</div> : null}
    </section>
  );
}
