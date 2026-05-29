"use client";

import { useEffect, useState } from "react";

type PublishTargets = {
  shopify: { available: boolean };
  wordpressWoo: { available: boolean; reason?: string };
};

export function ArticleActions({ bountyId }: { bountyId: string }) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [targets, setTargets] = useState<PublishTargets | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [destination, setDestination] = useState<"shopify" | "wordpress_wc">("shopify");

  useEffect(() => {
    let cancelled = false;
    async function loadTargets() {
      setTargetsLoading(true);
      setTargetsError(null);
      try {
        const res = await fetch(
          `/api/geo/bounty/${encodeURIComponent(bountyId)}/publish-targets`,
          { credentials: "include" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          if (!cancelled) {
            setTargetsError(json?.error ?? "Could not load publish options");
            setTargets(null);
          }
          return;
        }
        const data = json.data as PublishTargets;
        if (!cancelled) {
          setTargets(data);
          if (data.shopify.available) {
            setDestination("shopify");
          } else if (data.wordpressWoo.available) {
            setDestination("wordpress_wc");
          } else {
            setDestination("shopify");
          }
        }
      } catch {
        if (!cancelled) {
          setTargetsError("Could not load publish options");
          setTargets(null);
        }
      } finally {
        if (!cancelled) setTargetsLoading(false);
      }
    }
    loadTargets();
    return () => {
      cancelled = true;
    };
  }, [bountyId]);

  const canPublish =
    targets &&
    (targets.shopify.available || targets.wordpressWoo.available);

  const onApprove = async () => {
    setApproveLoading(true);
    setMessage(null);
    const path =
      destination === "shopify"
        ? `/api/geo/bounty/${encodeURIComponent(bountyId)}/approve-shopify`
        : `/api/geo/bounty/${encodeURIComponent(bountyId)}/approve-wordpress`;

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const err =
          json?.error ||
          (res.status === 207
            ? "Published to Shopify with warnings (partial success)."
            : destination === "shopify"
              ? "Failed to publish to Shopify."
              : "Failed to publish to WordPress.");
        const details =
          destination === "shopify" && json?.data?.articleId
            ? ` Article GID: ${json.data.articleId}`
            : destination === "wordpress_wc" && json?.data?.postId
              ? ` Post ID: ${json.data.postId}`
              : "";
        setMessage(`${err}${details}`);
        return;
      }

      if (destination === "shopify") {
        const articleId = json?.data?.article?.id ?? json?.data?.articleId ?? null;
        setMessage(
          articleId
            ? `Published to Shopify Blog. Article GID: ${articleId}`
            : "Published to Shopify Blog."
        );
      } else {
        const link = json?.data?.link;
        const postId = json?.data?.postId;
        setMessage(
          link
            ? `Published to WordPress. ${postId != null ? `Post ID: ${postId}. ` : ""}${link}`
            : postId != null
              ? `Published to WordPress. Post ID: ${postId}`
              : "Published to WordPress."
        );
      }
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

  return (
    <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)]/40 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">Publish to</span>
          <select
            value={destination}
            onChange={(e) =>
              setDestination(e.target.value as "shopify" | "wordpress_wc")
            }
            disabled={targetsLoading || !canPublish}
            className="rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-foreground max-w-[min(100%,220px)]"
          >
            <option value="shopify" disabled={!targets?.shopify.available}>
              Shopify
            </option>
            <option
              value="wordpress_wc"
              disabled={!targets?.wordpressWoo.available}
            >
              WooCommerce (WordPress post)
            </option>
          </select>
        </label>
        <button
          type="button"
          onClick={onApprove}
          disabled={approveLoading || !canPublish}
          className="glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {approveLoading ? "Publishing…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-hover)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--glass-hover)]/80"
        >
          Regenerate
        </button>
      </div>

      {targetsLoading ? (
        <p className="text-xs text-muted-foreground">Loading publish options…</p>
      ) : null}

      {targetsError ? (
        <p className="text-xs text-destructive">{targetsError}</p>
      ) : null}

      {!targetsLoading && targets && !canPublish ? (
        <p className="text-xs text-muted-foreground">
          Connect Shopify or WordPress (same URL as WooCommerce if you use WooCommerce) under
          Connection to publish.
        </p>
      ) : null}

      {!targetsLoading && targets?.wordpressWoo.reason && !targets.wordpressWoo.available ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          WooCommerce (WordPress): {targets.wordpressWoo.reason}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        On approval, this page is published to the destination you select (Shopify blog or
        WordPress post on your store).
      </p>

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
