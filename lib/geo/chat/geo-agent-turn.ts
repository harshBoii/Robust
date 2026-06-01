import 'server-only';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { CHAT_AGENT_MODEL } from '@/lib/assistant/models';
import { buildAgentHistoryMessages } from '@/lib/chats/agent-turn';
import type { SerializedMessage } from '@/lib/chats/types';

import { buildGeoAgentContextBlock, buildGeoAgentSystemPrompt } from './geo-agent-prompt';
import { normalizeGeoAgentTurn, type GeoAgentTurn } from './geo-agent-schema';
import type { GeoChatState } from './types';

const MAX_TOOL_RESULT_CHARS = 12_000;

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

export async function runGeoAgentTurn(input: {
  userText: string;
  geo: GeoChatState | undefined;
  priorMessages: SerializedMessage[];
  toolResults?: Array<{ name: string; result: { ok: boolean; data?: unknown; error?: string } }>;
}): Promise<GeoAgentTurn> {
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

  const raw = await completeJsonChatWithHistory({
    model: CHAT_AGENT_MODEL,
    system: buildGeoAgentSystemPrompt(),
    messages: apiMessages,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  return normalizeGeoAgentTurn(parsed);
}
