import 'server-only';

import OpenAI from 'openai';

import { CREATIVE_ANALYSIS_MODEL } from '@/lib/assistant/models';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

function extractResponsesOutputText(response: unknown): string {
  if (typeof response !== 'object' || response === null) return '{}';
  const r = response as Record<string, unknown>;
  if (typeof r.output_text === 'string' && r.output_text.trim()) {
    return r.output_text;
  }
  const output = r.output;
  if (!Array.isArray(output)) return '{}';
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== 'object' || part === null) continue;
      const p = part as { type?: string; text?: string };
      if (p.type === 'output_text' && typeof p.text === 'string' && p.text.trim()) {
        return p.text;
      }
    }
  }
  return '{}';
}

/** GPT-5.x Responses API with reasoning effort (e.g. xhigh for video scripts). */
export async function completeJsonResponses(params: {
  model: string;
  system: string;
  user: string;
  reasoning?: { effort: ReasoningEffort };
}): Promise<string> {
  const response = await openai.responses.create({
    model: params.model,
    reasoning: params.reasoning ?? { effort: 'xhigh' },
    instructions: params.system,
    input: [{ role: 'user', content: params.user }],
    text: { format: { type: 'json_object' } },
  });

  const text =
    typeof response.output_text === 'string' && response.output_text.trim()
      ? response.output_text
      : extractResponsesOutputText(response);

  return text.trim() || '{}';
}

export async function completeJsonChat(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await openai.chat.completions.create({
    model: params.model,
    // max_tokens: params.maxTokens ?? 1200,
    // temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  });
  return res.choices[0]?.message?.content ?? '{}';
}

export async function completeJsonChatWithHistory(params: {
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const res = await openai.chat.completions.create({
    model: params.model,
    // max_tokens: params.maxTokens ?? 1200,
    // temperature: 0.6,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.system },
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  return res.choices[0]?.message?.content ?? '{}';
}

export async function completeVisionJsonChat(params: {
  system: string;
  userText: string;
  imageUrls: string[];
  maxTokens?: number;
}): Promise<string> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: params.userText },
    ...params.imageUrls.map(
      (url): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: { url },
      }),
    ),
  ];

  const res = await openai.chat.completions.create({
    model: CREATIVE_ANALYSIS_MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: params.system }, { role: 'user', content }],
  });
  return res.choices[0]?.message?.content ?? '{}';
}
