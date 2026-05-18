import { buildPresetBuilderSystemPrompt } from './preset-prompt';

export function buildPresetChatSystemPrompt(): string {
  return `${buildPresetBuilderSystemPrompt()}

Additionally:
- Include a "reply" field: short conversational message for the chat (1-3 sentences).
- On follow-up messages, return ONLY fields the user asked to change (delta patches), not the full preset.
- Use "explanation" as internal summary; "reply" is what the user reads in chat.
- Users may paste Meta API errors (e.g. "(#100) The parameter special_ad_categories is required") — map the error to the correct campaign or adset field and fix it.
- For special_ad_categories required: set campaign.specialAdCategories to ["NONE"] unless the user indicates a regulated category (CREDIT, EMPLOYMENT, HOUSING, etc.).
- For is_adset_budget_sharing_enabled required: set campaign.isAdsetBudgetSharingEnabled to true or false (use false unless user wants sharing).
- No ad type or tone is required from the user; infer from current drafts and the request.
- If the user describes a problem without naming a field, diagnose and patch the minimum fields needed.`;
}

export function buildPresetChatMessagesForApi(input: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  adType?: string | null;
  tone?: string | null;
  currentCampaignDraft?: unknown;
  currentAdsetDraft?: unknown;
}): { role: 'user' | 'assistant'; content: string }[] {
  const adTypeLine = input.adType?.trim()
    ? `Ad type (objective): ${input.adType}`
    : 'Ad type: infer from current campaign draft objective if present.';
  const toneLine = input.tone?.trim()
    ? `Tone: ${input.tone}`
    : 'Tone: not specified — use sensible defaults from the request.';

  const contextNote = `Context — ${adTypeLine}
${toneLine}
Current campaign draft: ${JSON.stringify(input.currentCampaignDraft ?? {})}
Current adset draft: ${JSON.stringify(input.currentAdsetDraft ?? {})}`;

  const history = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (history.length === 0) {
    return [
      {
        role: 'user' as const,
        content: `${contextNote}\n\nHelp fix or improve the preset based on the user's needs.`,
      },
    ];
  }

  const last = history[history.length - 1];
  if (last?.role === 'user') {
    return [
      ...history.slice(0, -1),
      { role: 'user' as const, content: `${contextNote}\n\nUser request: ${last.content}` },
    ];
  }

  return [...history, { role: 'user' as const, content: contextNote }];
}

export function resolvePresetChatAdType(
  explicit: string | null | undefined,
  campaignDraft: unknown,
): string {
  if (explicit?.trim()) return explicit.trim();
  if (
    campaignDraft &&
    typeof campaignDraft === 'object' &&
    typeof (campaignDraft as { objective?: unknown }).objective === 'string' &&
    (campaignDraft as { objective: string }).objective.trim()
  ) {
    return (campaignDraft as { objective: string }).objective.trim();
  }
  return 'OUTCOME_SALES';
}

export function resolvePresetChatTone(explicit: string | null | undefined): string {
  return explicit?.trim() || 'general';
}
