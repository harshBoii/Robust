'use client';

import { useCallback, useMemo, useState } from 'react';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';

import {
  mergeAdsetPresetPatch,
  mergeCampaignPresetPatch,
} from '@/lib/assistant/merge-preset-patch';
import type { AdsetPresetPatch, CampaignPresetPatch } from '@/lib/assistant/schemas';

import { PresetFieldPreviewCard } from './FieldPreviewCard';
import { RobustaChatShell, type QuickReply } from './RobustaChatShell';
import type { ChatMessageItem } from './RobustaChatMessage';
import { SkippedFieldsBanner } from './SkippedFieldsBanner';

const HELPER_QUICK_REPLIES: QuickReply[] = [
  { id: 'special-ad', label: 'Fix special_ad_categories error' },
  { id: 'budget', label: 'Set a daily budget' },
  { id: 'targeting-in', label: 'Target India mobile' },
];

type PresetChatResult = {
  reply: string;
  campaign: Partial<CampaignPresetPatch> | null;
  adset: Partial<AdsetPresetPatch> | null;
  explanation?: string;
  skippedFields: string[];
  partial: boolean;
};

export type PresetModeRendererProps = {
  activePresetTab?: 'campaign' | 'adset';
  adType: string | null;
  tone: string | null;
  onAdTypeChange: (v: string) => void;
  onToneChange: (v: string) => void;
  draftCampaign: CampaignPreset | null;
  draftAdset: AdsetPreset | null;
  onApplyCampaign: (next: CampaignPreset) => void;
  onApplyAdset: (next: AdsetPreset) => void;
  onAdvancedTargetingSync?: (json: string) => void;
  showDefaultWarning?: boolean;
  disabled?: boolean;
};

function uid() {
  return crypto.randomUUID();
}

function isApplyCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'apply' || t === 'apply to form' || t === 'fill form' || t === 'use these values';
}

function resolveAdType(explicit: string | null, draft: CampaignPreset | null): string {
  if (explicit?.trim()) return explicit.trim();
  if (draft?.objective?.trim()) return draft.objective.trim();
  return 'OUTCOME_SALES';
}

function resolveTone(explicit: string | null): string {
  return explicit?.trim() || 'general';
}

async function fetchPresetChat(body: Record<string, unknown>): Promise<PresetChatResult> {
  const res = await fetch('/api/assistant/preset-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PresetChatResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function PresetModeRenderer({
  activePresetTab = 'campaign',
  adType,
  tone,
  onAdTypeChange,
  draftCampaign,
  draftAdset,
  onApplyCampaign,
  onApplyAdset,
  onAdvancedTargetingSync,
  showDefaultWarning,
  disabled,
}: PresetModeRendererProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm Miss Robusta. Paste a Meta error, describe what you need, or ask me to change any preset field — I'll update your form immediately. No setup required.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<PresetChatResult | null>(null);

  const applyPatches = useCallback(
    (
      result: PresetChatResult,
      baseCampaign: CampaignPreset | null,
      baseAdset: AdsetPreset | null,
    ): { campaign: CampaignPreset | null; adset: AdsetPreset | null; applied: boolean } => {
      let nextCampaign = baseCampaign;
      let nextAdset = baseAdset;
      let applied = false;

      if (result.campaign && baseCampaign) {
        nextCampaign = mergeCampaignPresetPatch(baseCampaign, result.campaign);
        onApplyCampaign(nextCampaign);
        if (result.campaign.objective) onAdTypeChange(result.campaign.objective);
        applied = true;
      }
      if (result.adset && baseAdset) {
        nextAdset = mergeAdsetPresetPatch(baseAdset, result.adset);
        onApplyAdset(nextAdset);
        if (result.adset.targeting && onAdvancedTargetingSync) {
          onAdvancedTargetingSync(JSON.stringify(result.adset.targeting, null, 2));
        }
        applied = true;
      }

      return { campaign: nextCampaign, adset: nextAdset, applied };
    },
    [onApplyCampaign, onApplyAdset, onAdvancedTargetingSync, onAdTypeChange],
  );

  const appendAssistantResult = useCallback(
    (
      data: PresetChatResult,
      merged: { campaign: CampaignPreset | null; adset: AdsetPreset | null },
      applied: boolean,
    ) => {
      const campaignSkipped = data.skippedFields.filter((f) => f.startsWith('campaign.'));
      const adsetSkipped = data.skippedFields.filter((f) => f.startsWith('adset.'));

      const tabHint =
        !applied
          ? '\n\nI could not write to the form — make sure a preset draft is open.'
          : activePresetTab === 'campaign' && data.adset && Object.keys(data.adset).length > 0
            ? '\n\nAd set fields were updated too — switch to **Ad Set Presets** to review them.'
            : activePresetTab === 'adset' && data.campaign && Object.keys(data.campaign).length > 0
              ? '\n\nCampaign fields were updated too — switch to **Campaign Presets** to review them.'
              : '';

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: `${data.reply}${tabHint}`,
          children: (
            <>
              <SkippedFieldsBanner skippedFields={campaignSkipped} prefix="Campaign" />
              <SkippedFieldsBanner skippedFields={adsetSkipped} prefix="Ad set" />
              <PresetFieldPreviewCard campaign={merged.campaign} adset={merged.adset} />
            </>
          ),
        },
      ]);
    },
    [activePresetTab],
  );

  const runPresetChat = useCallback(
    async (history: { role: 'user' | 'assistant'; content: string }[]) => {
      setLoading(true);
      try {
        const effectiveAdType = resolveAdType(adType, draftCampaign);
        const effectiveTone = resolveTone(tone);

        const data = await fetchPresetChat({
          messages: history,
          adType: effectiveAdType,
          tone: effectiveTone,
          currentCampaignDraft: draftCampaign,
          currentAdsetDraft: draftAdset,
        });

        setLastResult(data);
        const merged = applyPatches(data, draftCampaign, draftAdset);
        appendAssistantResult(data, merged, merged.applied);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: e instanceof Error ? e.message : 'Something went wrong. Try again.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      adType,
      tone,
      draftCampaign,
      draftAdset,
      applyPatches,
      appendAssistantResult,
    ],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (disabled) return;

      const userMsg: ChatMessageItem = { id: uid(), role: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);

      if (isApplyCommand(text) && lastResult) {
        const merged = applyPatches(lastResult, draftCampaign, draftAdset);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: merged.applied
              ? 'Done — I applied the latest suggestions to your form.'
              : 'Nothing to apply yet — send a request first.',
            children: merged.applied ? (
              <PresetFieldPreviewCard campaign={merged.campaign} adset={merged.adset} />
            ) : undefined,
          },
        ]);
        return;
      }

      const history = [
        ...messages.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content! })),
        { role: 'user' as const, content: text },
      ];

      void runPresetChat(history);
    },
    [disabled, messages, lastResult, draftCampaign, draftAdset, runPresetChat, applyPatches],
  );

  const quickReplies = useMemo(() => HELPER_QUICK_REPLIES, []);

  if (disabled) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Preset help is available on the Campaign and Ad Set steps.
      </p>
    );
  }

  return (
    <RobustaChatShell
      messages={messages}
      onSend={handleSend}
      loading={loading}
      quickReplies={quickReplies}
      inputPlaceholder="Paste a Meta error or describe what to fix…"
      headerBanner={
        showDefaultWarning ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            You are editing your default preset — review before saving.
          </div>
        ) : undefined
      }
    />
  );
}
