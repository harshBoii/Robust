import 'server-only';

import type { DbChatSession } from '@/lib/chats/repository';
import type { SerializedMessage } from '@/lib/chats/types';
import { prisma } from '@/lib/prisma';

import {
  fetchRivalIntelligenceSummary,
  listRivalsWithCompletedSummaries,
} from './fetch-summary-for-chat';

export type RivalInspirationStep = 'rivalInspirationAsk' | 'rivalBrandPick';

export type RivalInspirationCallbacks = {
  appendAssistant: (
    content: string,
    widgetType?: string | null,
    widgetPayload?: unknown,
  ) => Promise<SerializedMessage>;
  onContinue: () => Promise<void>;
};

export async function promptRivalInspirationIfAvailable(
  session: DbChatSession,
  callbacks: RivalInspirationCallbacks & {
    setStep: (step: RivalInspirationStep) => void;
    widgetPrefix: 'imageGen' | 'videoGen';
  },
): Promise<'prompted' | 'skipped'> {
  const available = await listRivalsWithCompletedSummaries(session.companyId);

  if (available.length === 0) {
    const rivalCount = await prisma.companyRival.count({
      where: { companyId: session.companyId },
    });
    const msg =
      rivalCount === 0
        ? 'No rival brands are set up yet — add rivals on **Rival Analysis** first. Continuing without rival inspiration.'
        : 'Rival analysis summaries are not ready yet — run analysis on **Rival Analysis**, then try again. Continuing without rival inspiration.';
    await callbacks.appendAssistant(msg);
    await callbacks.onContinue();
    return 'skipped';
  }

  callbacks.setStep('rivalInspirationAsk');
  await callbacks.appendAssistant(
    'Would you like to take creative inspiration from your tracked rival brands?',
    `${callbacks.widgetPrefix}RivalInspirationChoice`,
    {},
  );
  return 'prompted';
}

export async function handleRivalInspirationChosen(
  session: DbChatSession,
  enabled: boolean,
  callbacks: RivalInspirationCallbacks & {
    setStep: (step: RivalInspirationStep) => void;
    setRivalInspirationEnabled: (enabled: boolean) => void;
    widgetPrefix: 'imageGen' | 'videoGen';
  },
): Promise<void> {
  callbacks.setRivalInspirationEnabled(enabled);

  if (!enabled) {
    await callbacks.appendAssistant('Got it — continuing without rival inspiration.');
    await callbacks.onContinue();
    return;
  }

  const available = await listRivalsWithCompletedSummaries(session.companyId);
  callbacks.setStep('rivalBrandPick');
  await callbacks.appendAssistant(
    'Which rival brand should I learn from? You can pick one or use a mix of your top rivals.',
    `${callbacks.widgetPrefix}RivalBrandPicker`,
    {
      rivals: available.map((r) => ({ id: r.id, brandName: r.brandName })),
    },
  );
}

export async function handleRivalBrandChosen(
  session: DbChatSession,
  brandName: string | null | undefined,
  callbacks: RivalInspirationCallbacks & {
    setRivalBrandName: (name: string | null) => void;
    setRivalIntelligenceBrief: (brief: string | undefined) => void;
  },
): Promise<void> {
  const useMix = brandName === null || brandName === undefined || brandName === '';
  callbacks.setRivalBrandName(useMix ? null : brandName);

  const result = await fetchRivalIntelligenceSummary(session.companyId, {
    brandName: useMix ? undefined : brandName,
  });

  if (!result.ok || !result.brief) {
    await callbacks.appendAssistant(
      result.error ?? 'Could not load rival intelligence. Continuing without it.',
    );
    await callbacks.onContinue();
    return;
  }

  callbacks.setRivalIntelligenceBrief(result.brief);
  const names = result.rivalsUsed.map((r) => r.brandName).join(', ');
  await callbacks.appendAssistant(
    `Pulled intelligence from **${names}** — I'll use this for creative direction.`,
  );
  await callbacks.onContinue();
}

export function parseRivalInspirationYesNo(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (/^(yes|y|yeah|yep|sure|ok|okay|please|definitely)\b/.test(t)) return true;
  if (/^(no|n|nope|nah|skip|not now|without)\b/.test(t)) return false;
  return null;
}
