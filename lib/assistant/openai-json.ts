import 'server-only';

import OpenAI from 'openai';

import { CREATIVE_ANALYSIS_MODEL } from '@/lib/assistant/models';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
