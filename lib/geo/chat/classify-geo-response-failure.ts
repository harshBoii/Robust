import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';
import { CLASSIFIER_MODEL } from '@/lib/image-gen/models';

import type { GeoAgentTurn } from './geo-agent-schema';

const schema = z.object({
  isFailure: z.boolean(),
});

const SYSTEM = `You classify whether a GEO chat assistant turn is a **failed or unusable** response that should be retried.

A response IS a failure when:
- Generic fallback asking to rephrase with no substantive GEO answer
- Parse/technical failure boilerplate ("had trouble processing", "couldn't understand")
- Empty or non-answer platitudes that ignore a clear user request
- The assistant failed to use tools or answer when the user asked for data, actions, or strategy

A response is NOT a failure when:
- The assistant answered with GEO strategy, metrics, or next steps (even if brief)
- The assistant asked a **specific** clarifying question needed to proceed (e.g. which bounty, which platform)
- status is "tool" with valid toolCalls to fetch data or run actions
- The assistant correctly explains a blocker (e.g. integration not connected) with useful detail
- The user message is vague and a polite onboarding prompt is appropriate

Use the user's message as context: if they asked something concrete and the assistant only gave a generic error, that is a failure.

Respond with JSON only: { "isFailure": true | false }`;

export function summarizeGeoTurnForClassifier(turn: GeoAgentTurn): string {
  if (turn.status === 'tool') {
    const names = (turn.toolCalls ?? []).map((t) => t.name).join(', ') || '(none)';
    return `status: tool\ntoolCalls: ${names}`;
  }
  return `status: reply\nreply: ${turn.reply?.trim() ?? '(empty)'}`;
}

export async function classifyGeoResponseFailure(input: {
  userText: string;
  turn: GeoAgentTurn;
  rawParseFailed?: boolean;
}): Promise<boolean> {
  if (input.turn.status === 'tool' && (input.turn.toolCalls?.length ?? 0) > 0) {
    return false;
  }

  if (input.rawParseFailed) {
    return true;
  }

  const user = [
    `User message:\n${input.userText.trim()}`,
    `Assistant turn:\n${summarizeGeoTurnForClassifier(input.turn)}`,
  ].join('\n\n');

  try {
    const raw = await completeJsonChat({
      model: CLASSIFIER_MODEL,
      system: SYSTEM,
      user,
    });
    const parsed = schema.parse(JSON.parse(raw));
    return parsed.isFailure;
  } catch {
    return isLikelyGeoFailureFallback(input.turn);
  }
}

/** Regex fallback when classifier JSON fails. */
export function isLikelyGeoFailureFallback(turn: GeoAgentTurn): boolean {
  if (turn.status === 'tool') return false;
  const reply = turn.reply?.trim().toLowerCase() ?? '';
  if (!reply) return true;
  const patterns = [
    /had trouble processing/,
    /could you rephrase/,
    /rephrase your geo/,
    /let me know what you would like to explore/,
    /how can i help with your geo/,
    /i need a moment/,
    /couldn't process/,
    /try again/,
    /something went wrong/,
  ];
  return patterns.some((p) => p.test(reply));
}
