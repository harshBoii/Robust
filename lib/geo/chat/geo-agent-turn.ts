import 'server-only';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { CHAT_AGENT_MODEL } from '@/lib/assistant/models';
import { buildAgentHistoryMessages } from '@/lib/chats/agent-turn';
import type { SerializedMessage } from '@/lib/chats/types';

import { classifyGeoResponseFailure } from './classify-geo-response-failure';
import { buildGeoAgentContextBlock, buildGeoAgentSystemPrompt } from './geo-agent-prompt';
import { normalizeGeoAgentTurn, type GeoAgentTurn } from './geo-agent-schema';
import type { GeoChatState } from './types';

const MAX_TOOL_RESULT_CHARS = 12_000;
export const MAX_GEO_AGENT_ATTEMPTS = 3;

const RETRY_APPENDIX = `

## Retry (important)
Your previous response was unusable (invalid JSON or a generic error). Respond with valid JSON only. Address the user's request directly — use tools if you need data or to take action. Never draft blog/social post copy in reply; use geo.get_cited for X, LinkedIn, Reddit, and blogs.`;

export function formatToolResultsForLlm(
  results: Array<{ name: string; result: { ok: boolean; data?: unknown; error?: string } }>,
): string {
  const payload = results.map((r) => ({
    tool: r.name,
    ok: r.result.ok,
    data: r.result.data,
    error: r.result.error,
  }));
  let text = JSON.stringify(payload, null, 2);
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text = `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…(truncated)`;
  }
  return text;
}

async function runGeoAgentTurnOnce(input: {
  userText: string;
  geo: GeoChatState | undefined;
  priorMessages: SerializedMessage[];
  toolResults?: Array<{ name: string; result: { ok: boolean; data?: unknown; error?: string } }>;
  attempt: number;
}): Promise<{ turn: GeoAgentTurn; rawParseFailed: boolean }> {
  const history = buildAgentHistoryMessages(input.priorMessages);
  const contextBlock = buildGeoAgentContextBlock(input.geo);

  const userParts = [contextBlock, `User message:\n${input.userText}`];
  if (input.toolResults?.length) {
    userParts.unshift(
      `Tool results (use these facts in your response):\n${formatToolResultsForLlm(input.toolResults)}`,
    );
  }

  const apiMessages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history,
    { role: 'user', content: userParts.join('\n\n---\n\n') },
  ];

  const system =
    buildGeoAgentSystemPrompt() + (input.attempt > 1 ? RETRY_APPENDIX : '');

  const raw = await completeJsonChatWithHistory({
    model: CHAT_AGENT_MODEL,
    system,
    messages: apiMessages,
  });

  let parsed: unknown;
  let rawParseFailed = false;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
    rawParseFailed = true;
  }

  return { turn: normalizeGeoAgentTurn(parsed), rawParseFailed };
}

export async function runGeoAgentTurn(input: {
  userText: string;
  geo: GeoChatState | undefined;
  priorMessages: SerializedMessage[];
  toolResults?: Array<{ name: string; result: { ok: boolean; data?: unknown; error?: string } }>;
}): Promise<GeoAgentTurn> {
  let lastTurn: GeoAgentTurn = {
    status: 'reply',
    reply: 'I had trouble processing that. Could you rephrase your GEO question?',
  };

  for (let attempt = 1; attempt <= MAX_GEO_AGENT_ATTEMPTS; attempt++) {
    const { turn, rawParseFailed } = await runGeoAgentTurnOnce({
      ...input,
      attempt,
    });
    lastTurn = turn;

    if (turn.status === 'tool') {
      return turn;
    }

    const isFailure = await classifyGeoResponseFailure({
      userText: input.userText,
      turn,
      rawParseFailed,
    });

    if (!isFailure) {
      return turn;
    }

    if (attempt < MAX_GEO_AGENT_ATTEMPTS) {
      continue;
    }
  }

  return lastTurn;
}
