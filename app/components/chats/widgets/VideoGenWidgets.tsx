'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ChatWidgetDispatch } from './ChatWidgets';

function WidgetPrompt({ title }: { title?: string }) {
  if (!title?.trim()) return null;
  return <p className="mb-3 text-[14px] leading-relaxed text-foreground/95">{title}</p>;
}

type SubpathOption = { id: string; label: string; description: string };

export function VideoGenSubpathChoiceWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const subpaths = (payload.subpaths as SubpathOption[]) ?? [];
  const title = typeof payload.title === 'string' ? payload.title : undefined;
  return (
    <div className="grid gap-2 sm:grid-cols-1">
      <WidgetPrompt title={title} />
      {subpaths.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => void onAction('videoGen.subpathChosen', { subpath: s.id }, s.label)}
          className="rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="text-[14px] font-medium text-foreground">{s.label}</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">{s.description}</div>
        </button>
      ))}
    </div>
  );
}

export function VideoGenOfferingPickerWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const title = typeof payload.title === 'string' ? payload.title : undefined;
  const offerings =
    (payload.offerings as Array<{ id: string; name: string; description?: string | null }>) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <WidgetPrompt title={title} />
      {offerings.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => void onAction('videoGen.offeringSelected', { offeringId: o.id }, o.name)}
          className="rounded-lg border border-border/50 px-3 py-2 text-left text-[13px] hover:border-primary/40"
        >
          <div className="font-medium">{o.name}</div>
          {o.description ? (
            <div className="mt-0.5 line-clamp-2 text-muted-foreground">{o.description}</div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function VideoGenAdTypePickerWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const title = typeof payload.title === 'string' ? payload.title : undefined;
  const categories =
    (payload.categories as Array<{ id: string; label: string }>) ?? [];
  return (
    <div className="space-y-3">
      <WidgetPrompt title={title} />
      <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() =>
            void onAction('videoGen.adTypeSelected', { category: c.id }, c.label)
          }
          className="rounded-full border border-border/50 px-3 py-1.5 text-[12px] font-medium hover:border-primary/40 hover:bg-primary/5"
        >
          {c.label}
        </button>
      ))}
      </div>
    </div>
  );
}

export function VideoGenScriptReviewWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const title = typeof payload.title === 'string' ? payload.title : undefined;
  const adScript = typeof payload.adScript === 'string' ? payload.adScript : '';
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-3">
      <WidgetPrompt title={title} />
      {adScript ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/30 p-3 text-[13px] leading-relaxed">
          {adScript}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onAction('videoGen.scriptApproved', {}, 'Approve script')}
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
        >
          Approve & generate video
        </button>
      </div>
      <div className="space-y-2 border-t border-border/40 pt-3">
        <label className="text-[12px] text-muted-foreground">Request changes</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. make the hook punchier, more emotional…"
          className="min-h-[72px] w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          disabled={!feedback.trim()}
          onClick={() => {
            const text = feedback.trim();
            void onAction('videoGen.scriptChangeRequested', { feedback: text }, text);
            setFeedback('');
          }}
          className="rounded-full border border-border/50 px-3 py-1.5 text-[12px] font-medium disabled:opacity-40"
        >
          Send feedback
        </button>
      </div>
    </div>
  );
}

type LibraryAsset = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  intelligenceStatus: string;
};

export function VideoGenAdLibraryPickerWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const title = typeof payload.title === 'string' ? payload.title : undefined;
  const assets = (payload.assets as LibraryAsset[]) ?? [];
  if (!assets.length) {
    return (
      <div>
        <WidgetPrompt title={title} />
        <p className="text-[13px] text-muted-foreground">
          No video ads in your library yet. Upload videos in Gallery first.
        </p>
      </div>
    );
  }
  return (
    <div>
      <WidgetPrompt title={title} />
      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
      {assets.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => void onAction('videoGen.adSelected', { assetId: a.id }, a.title)}
          className="flex gap-2 rounded-lg border border-border/50 p-2 text-left hover:border-primary/40"
        >
          {a.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.thumbnailUrl} alt="" className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-[10px]">
              Video
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{a.title}</div>
            <div className="text-[11px] text-muted-foreground">Intel: {a.intelligenceStatus}</div>
          </div>
        </button>
      ))}
      </div>
    </div>
  );
}

export function VideoGenAnalyzingWidget({ payload }: { payload?: Record<string, unknown> }) {
  const title =
    typeof payload?.title === 'string' ? payload.title : 'Analyzing video ads… this may take a few minutes.';
  return <p className="text-[13px] text-muted-foreground animate-pulse">{title}</p>;
}

export function VideoGenGeneratingWidget({ payload }: { payload?: Record<string, unknown> }) {
  const title =
    typeof payload?.title === 'string' ? payload.title : 'Writing your ad script…';
  return <p className="text-[13px] text-muted-foreground animate-pulse">{title}</p>;
}

export function VideoGenHeygenProgressWidget({
  sessionId,
  payload,
  onAction,
}: {
  sessionId: string;
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const jobId = typeof payload.jobId === 'string' ? payload.jobId : null;
  const [status, setStatus] = useState<string | null>(
    typeof payload.progressMessage === 'string' ? payload.progressMessage : 'Generating video…',
  );
  const [done, setDone] = useState(false);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/chats/${sessionId}/video-gen/status`);
      const data = (await res.json()) as {
        ok?: boolean;
        job?: { heygenStatus?: string; progressMessage?: string };
        generatedAssetId?: string | null;
      };
      if (data.job?.progressMessage) setStatus(data.job.progressMessage);
      if (data.job?.heygenStatus === 'FAILED') {
        setStatus('Video generation failed. You can edit the script and try again.');
        return;
      }
      if (data.generatedAssetId || data.job?.heygenStatus === 'COMPLETED') {
        setDone(true);
        setStatus('Your video is ready in your library.');
      }
    } catch {
      /* ignore transient poll errors */
    }
  }, [jobId, sessionId]);

  useEffect(() => {
    if (!jobId || done) return;
    void poll();
    const id = window.setInterval(() => void poll(), 30_000);
    return () => window.clearInterval(id);
  }, [jobId, done, poll]);

  const title = typeof payload.title === 'string' ? payload.title : undefined;

  return (
    <div className="space-y-2">
      <WidgetPrompt title={title} />
      <p className="text-[13px] text-muted-foreground animate-pulse">{status}</p>
      {done ? (
        <a
          href="/gallery"
          className="inline-block text-[13px] font-medium text-primary underline"
        >
          Open gallery
        </a>
      ) : null}
    </div>
  );
}

export function VideoGenDoneWidget({ payload }: { payload: Record<string, unknown> }) {
  const assetId = typeof payload.assetId === 'string' ? payload.assetId : null;
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-foreground">Your video has been added to your library.</p>
      <a href="/gallery" className="text-[13px] font-medium text-primary underline">
        View in gallery
      </a>
      {assetId ? (
        <p className="text-[11px] text-muted-foreground">Asset ID: {assetId}</p>
      ) : null}
    </div>
  );
}
