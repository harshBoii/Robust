'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildCreativeApplyPatch } from '@/lib/assistant/merge-preset-patch';

import {
  CreativeFieldPreviewCard,
  type CreativePreview,
} from './FieldPreviewCard';
import { RobustaChatShell, type QuickReply } from './RobustaChatShell';
import type { ChatMessageItem } from './RobustaChatMessage';
import { SkippedFieldsBanner } from './SkippedFieldsBanner';

type CreativeSuggestResult = {
  headline: string;
  primaryText: string;
  description?: string;
  ctaType: string;
  landingUrl?: string;
  rationale: string;
  skippedFields: string[];
  partial: boolean;
};

type CreativeRefineResult = CreativeSuggestResult & {
  reply: string;
};

export type CreativeFields = {
  headline: string;
  primaryText: string;
  description: string;
  landingUrl: string;
  ctaType: string;
  pixelId: string;
};

export type CreativeModeRendererProps = {
  adType: string | null;
  tone: string | null;
  onAdTypeCapture?: (v: string) => void;
  onToneCapture?: (v: string) => void;
  assetId: string | null;
  groupLabel?: string;
  currentCreative?: CreativeFields;
  onApply: (patch: Record<string, string>) => void;
  disabled?: boolean;
};

function uid() {
  return crypto.randomUUID();
}

function toPreview(c: CreativeFields): CreativePreview {
  return {
    headline: c.headline,
    primaryText: c.primaryText,
    description: c.description || undefined,
    ctaType: c.ctaType,
    landingUrl: c.landingUrl || undefined,
  };
}

function resolveAdType(explicit: string | null): string {
  return explicit?.trim() || 'OUTCOME_SALES';
}

function resolveTone(explicit: string | null): string {
  return explicit?.trim() || 'general';
}

export function CreativeModeRenderer({
  adType,
  tone,
  onAdTypeCapture,
  onToneCapture,
  assetId,
  groupLabel,
  currentCreative,
  onApply,
  disabled,
}: CreativeModeRendererProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const creativeRef = useRef<CreativeFields | undefined>(currentCreative);

  creativeRef.current = currentCreative;

  const effectiveAdType = resolveAdType(adType);
  const effectiveTone = resolveTone(tone);

  const appendAssistant = useCallback((content: string, children?: React.ReactNode) => {
    setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content, children }]);
  }, []);

  const applyCreativeResult = useCallback(
    (data: Partial<CreativeSuggestResult> & { skippedFields?: string[] }) => {
      const patch = buildCreativeApplyPatch(
        {
          headline: data.headline,
          primaryText: data.primaryText,
          description: data.description,
          ctaType: data.ctaType,
          landingUrl: data.landingUrl,
        },
        data.skippedFields ?? [],
      );
      onApply(patch);

      if (creativeRef.current) {
        creativeRef.current = {
          ...creativeRef.current,
          headline: patch.headline ?? creativeRef.current.headline,
          primaryText: patch.primaryText ?? creativeRef.current.primaryText,
          description: patch.description ?? creativeRef.current.description,
          ctaType: patch.ctaType ?? creativeRef.current.ctaType,
          landingUrl: patch.landingUrl ?? creativeRef.current.landingUrl,
        };
      }
      return creativeRef.current;
    },
    [onApply],
  );

  const runAnalyze = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/assistant/creative-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          adType: effectiveAdType,
          tone: effectiveTone,
          groupLabel,
        }),
      });
      const data = (await res.json()) as CreativeSuggestResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');

      applyCreativeResult(data);
      setHasAnalyzed(true);

      const preview: CreativePreview = {
        headline: data.headline,
        primaryText: data.primaryText,
        description: data.description,
        ctaType: data.ctaType,
        landingUrl: data.landingUrl,
      };

      appendAssistant(
        `${data.rationale}\n\nI've filled in your creative fields below.`,
        <>
          <SkippedFieldsBanner skippedFields={data.skippedFields} />
          <CreativeFieldPreviewCard creative={preview} />
        </>,
      );
    } catch (e) {
      appendAssistant(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }, [assetId, effectiveAdType, effectiveTone, groupLabel, applyCreativeResult, appendAssistant]);

  const runRefine = useCallback(
    async (userText: string) => {
      setLoading(true);
      try {
        const history = [
          ...messages.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content! })),
          { role: 'user' as const, content: userText },
        ];
        const res = await fetch('/api/assistant/creative-refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            adType: effectiveAdType,
            tone: effectiveTone,
            currentCreative: creativeRef.current ?? {},
          }),
        });
        const data = (await res.json()) as CreativeRefineResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Request failed');

        applyCreativeResult(data);

        const c = creativeRef.current;
        const preview: CreativePreview = c
          ? toPreview(c)
          : {
              headline: data.headline ?? '',
              primaryText: data.primaryText ?? '',
              description: data.description,
              ctaType: data.ctaType ?? 'LEARN_MORE',
              landingUrl: data.landingUrl,
            };

        appendAssistant(data.reply, (
          <>
            <SkippedFieldsBanner skippedFields={data.skippedFields} />
            <CreativeFieldPreviewCard creative={preview} />
          </>
        ));
      } catch (e) {
        appendAssistant(e instanceof Error ? e.message : 'Could not update copy.');
      } finally {
        setLoading(false);
      }
    },
    [messages, effectiveAdType, effectiveTone, applyCreativeResult, appendAssistant],
  );

  useEffect(() => {
    if (disabled) return;
    if (!assetId) {
      setMessages([
        {
          id: 'no-asset',
          role: 'assistant',
          content: 'Select or upload a video in this group to analyze frames for copy ideas.',
        },
      ]);
    } else {
      setMessages([
        {
          id: 'ready',
          role: 'assistant',
          content:
            "Paste a request or tap **Analyze my video** — I'll fill creative fields and you can keep chatting to tweak anything.",
        },
      ]);
    }
  }, [disabled, assetId]);

  const handleSend = useCallback(
    (text: string) => {
      if (disabled) return;

      const lower = text.toLowerCase();

      if (text.startsWith('OUTCOME_')) {
        onAdTypeCapture?.(text);
      }

      setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }]);

      if (lower.includes('analyze again') || lower.includes('re-analyze')) {
        void runAnalyze();
        return;
      }

      if (!hasAnalyzed && (lower.includes('analyze') || lower === 'analyze my video')) {
        void runAnalyze();
        return;
      }

      void runRefine(text);
    },
    [disabled, hasAnalyzed, onAdTypeCapture, runAnalyze, runRefine],
  );

  const quickReplies: QuickReply[] | undefined = (() => {
    if (!assetId || disabled) return undefined;
    if (!hasAnalyzed) {
      return [{ id: 'analyze', label: 'Analyze my video' }];
    }
    return [
      { id: 'shorter', label: 'Shorter headline' },
      { id: 'urgent', label: 'More urgent tone' },
      { id: 'reanalyze', label: 'Analyze again' },
    ];
  })();

  if (disabled) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Creative analysis is available on the Creative Fields step when a video is ready.
      </p>
    );
  }

  return (
    <RobustaChatShell
      messages={messages}
      onSend={handleSend}
      loading={loading}
      quickReplies={quickReplies}
      inputPlaceholder={
        hasAnalyzed ? 'Ask me to change any field…' : 'Analyze my video or describe changes…'
      }
    />
  );
}
