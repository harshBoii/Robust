"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { ModalBackdrop } from "@/app/components/common/ModalBackdrop";
import { ModalPortal } from "@/app/components/common/ModalPortal";

export type RedditPublishTargetChoice = {
  name: string;
  kind: "profile" | "subreddit";
  flairId?: string;
};

type RedditTargetDto = {
  kind: "profile" | "subreddit";
  name: string;
  label: string;
  title?: string | null;
  over18?: boolean;
};

type RedditFlairDto = {
  id: string;
  text: string;
};

type RedditPublishTargetModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (choice: RedditPublishTargetChoice) => void;
  publishing?: boolean;
};

function targetKey(t: RedditTargetDto) {
  return `${t.kind}:${t.name}`;
}

export function RedditPublishTargetModal({
  open,
  onClose,
  onConfirm,
  publishing = false,
}: RedditPublishTargetModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<RedditTargetDto[]>([]);
  const [defaultSubreddit, setDefaultSubreddit] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [flairs, setFlairs] = useState<RedditFlairDto[]>([]);
  const [flairsLoading, setFlairsLoading] = useState(false);
  const [flairId, setFlairId] = useState("");

  const loadTargets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/reddit/publish-targets", {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Failed to load subreddits");
      }
      const list = (json.data?.targets ?? []) as RedditTargetDto[];
      setTargets(list);
      setDefaultSubreddit(json.data?.defaultSubreddit ?? null);

      const defaultTarget =
        list.find((t) => t.name === json.data?.defaultSubreddit) ??
        list.find((t) => t.kind === "profile") ??
        list[0];
      setSelectedKey(defaultTarget ? targetKey(defaultTarget) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subreddits");
      setTargets([]);
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setFlairId("");
    setFlairs([]);
    void loadTargets();
  }, [open, loadTargets]);

  const selectedTarget = useMemo(
    () => targets.find((t) => targetKey(t) === selectedKey) ?? null,
    [targets, selectedKey],
  );

  useEffect(() => {
    if (!open || !selectedTarget || selectedTarget.kind === "profile") {
      setFlairs([]);
      setFlairId("");
      return;
    }

    let cancelled = false;
    setFlairsLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/integrations/reddit/flairs?subreddit=${encodeURIComponent(selectedTarget.name)}`,
          { credentials: "include" },
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setFlairs([]);
          return;
        }
        const next = (json.data?.flairs ?? []) as RedditFlairDto[];
        setFlairs(next);
        setFlairId("");
      } catch {
        if (!cancelled) setFlairs([]);
      } finally {
        if (!cancelled) setFlairsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, selectedTarget]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !publishing) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, publishing]);

  if (!open) return null;

  const profileTargets = targets.filter((t) => t.kind === "profile");
  const subredditTargets = targets.filter((t) => t.kind === "subreddit");

  return (
    <ModalPortal open={open}>
      <ModalBackdrop onClose={publishing ? undefined : onClose} contentClassName="max-w-md">
        <div
          className="flex w-full max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)]/80 bg-[var(--glass-bg-solid)] shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reddit-publish-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
            <h2 id="reddit-publish-title" className="font-display text-sm font-semibold text-foreground">
              Where should this post go?
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="glass-button rounded-lg p-1.5 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading communities…</p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            {!loading && !error && targets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No subreddits found for this Reddit account. Connect Reddit under Profile → Integrations
                and try again.
              </p>
            ) : null}

            {!loading && profileTargets.length > 0 ? (
              <div>
                <p className="mb-1.5 font-ui text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Your account
                </p>
                <ul className="space-y-1">
                  {profileTargets.map((t) => {
                    const key = targetKey(t);
                    const checked = selectedKey === key;
                    return (
                      <li key={key}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            checked
                              ? "border-[var(--sibling-primary)]/50 bg-[var(--sibling-primary)]/10"
                              : "border-[var(--glass-border)] hover:border-[var(--sibling-primary)]/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="reddit-target"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => setSelectedKey(key)}
                            disabled={publishing}
                          />
                          <span className="min-w-0 flex-1 text-foreground">{t.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {!loading && subredditTargets.length > 0 ? (
              <div>
                <p className="mb-1.5 font-ui text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Subreddits
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {subredditTargets.map((t) => {
                    const key = targetKey(t);
                    const checked = selectedKey === key;
                    return (
                      <li key={key}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                            checked
                              ? "border-[var(--sibling-primary)]/50 bg-[var(--sibling-primary)]/10"
                              : "border-[var(--glass-border)] hover:border-[var(--sibling-primary)]/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="reddit-target"
                            className="mt-0.5"
                            checked={checked}
                            onChange={() => setSelectedKey(key)}
                            disabled={publishing}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground">{t.label}</span>
                            {t.over18 ? (
                              <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                                NSFW
                              </span>
                            ) : null}
                            {defaultSubreddit === t.name ? (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">(default)</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {selectedTarget?.kind === "subreddit" && !flairsLoading && flairs.length > 0 ? (
              <label className="block text-xs text-muted-foreground">
                <span className="mb-1 block font-medium text-foreground">Post flair (optional)</span>
                <select
                  value={flairId}
                  onChange={(e) => setFlairId(e.target.value)}
                  disabled={publishing}
                  className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="">No flair</option>
                  {flairs.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.text}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {flairsLoading ? (
              <p className="text-[10px] text-muted-foreground">Loading flairs…</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--glass-border)] px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="rounded-md border border-[var(--glass-border)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={publishing || !selectedTarget || Boolean(error)}
              onClick={() => {
                if (!selectedTarget) return;
                onConfirm({
                  name: selectedTarget.name,
                  kind: selectedTarget.kind,
                  ...(flairId ? { flairId } : {}),
                });
              }}
              className="glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish to Reddit"}
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
