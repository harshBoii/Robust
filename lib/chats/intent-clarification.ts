import 'server-only';

import { z } from 'zod';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { LLM_USER_REPLY_PRIVACY_RULES } from '@/lib/assistant/user-facing-llm-error';
import { CHATS_INTENT_SUGGESTIONS } from '@/lib/chats/chat-path-suggestions';
import { classifyTopLevelPath } from '@/lib/image-gen/classify-top-level';
import { CLASSIFIER_MODEL } from '@/lib/image-gen/models';

export const MAX_INTENT_CLARIFICATION_QUESTIONS = 2;
const MAX_INTENT_SUGGESTIONS = 4;

export type TopLevelPath = 'ads' | 'imageGen' | 'videoGen' | 'geo';

const responseSchema = z.object({
  ready: z.boolean(),
  path: z.enum(['ads', 'imageGen', 'videoGen', 'geo']).optional(),
  reply: z.string().optional(),
  suggestions: z.array(z.string().min(1).max(120)).min(1).max(MAX_INTENT_SUGGESTIONS).optional(),
});

export type IntentClarificationResult =
  | { ready: true; path: TopLevelPath }
  | { ready: false; reply: string; suggestions: string[] };

const CHIP_CATALOG = CHATS_INTENT_SUGGESTIONS.map((s) => `- ${s}`).join('\n');

const SYSTEM = `You decide whether to route a new chat to the correct workflow or ask ONE clarifying follow-up question first.

Top-level paths:
- "ads": posting Meta/Facebook/Google ads, campaigns, ad sets, publishing, scheduling, uploading creatives for ads, pixel setup, budgets.
- "imageGen": creating or generating product images, ad creative images, image variants, product-on-model photoshoots, AI image generation — NOT posting to ad platforms.
- "videoGen": creating or generating video ads, video scripts, HeyGen video generation, UGC-style video ads, replicating winning video ads.
- "geo": organic growth, GEO/SEO/AEO, LLM citations, share of voice, bounties, get cited, publish blog/X/LinkedIn/Reddit — NOT paid ads.

When the user's intent clearly maps to one path, set ready=true and path.
Examples of CLEAR intent (route immediately, do not ask):
- "Create product ad images" → imageGen
- "Generate a video ad with HeyGen" → videoGen
- "Post an ad to Meta" → ads
- "What's my share of voice?" → geo

When intent is ambiguous between paths, set ready=false and:
1. Ask ONE short, focused question in reply.
2. End reply by inviting the user to tap one of the suggestion chips below or type their own answer.
3. Include suggestions: 2–4 short chip labels (≤12 words each) for only the paths you are unsure between — do NOT list every option.

Chip catalog (pick only labels that match the ambiguity; use exact wording when possible):
${CHIP_CATALOG}

Examples of AMBIGUOUS intent (ask first):
- "I want to generate an ad" → reply asks image vs video vs publish; suggestions e.g. ["Create product ad images", "Generate a video ad with HeyGen", "Post an ad to Meta"]
- "Make me an ad" → ask what kind; suggestions for the 2–3 most likely paths only.
- "Help with ads" → ask if visuals, video, or campaign setup; pick matching chips.

Rules:
- Ask at most one question per turn when ready=false.
- suggestions is REQUIRED when ready=false (2–4 items, never more than 4).
- When ready=true, omit reply and suggestions.
- If clarificationQuestionsAsked is already ${MAX_INTENT_CLARIFICATION_QUESTIONS}, you MUST set ready=true and pick the best path — do not ask another question.

${LLM_USER_REPLY_PRIVACY_RULES}

Respond JSON only:
{ "ready": boolean, "path"?: "ads" | "imageGen" | "videoGen" | "geo", "reply"?: string, "suggestions"?: string[] }`;

const DEFAULT_CLARIFICATION_REPLY =
  'Happy to help — are you looking to create a **static image ad**, a **video ad**, or **set up and publish** a campaign on Meta/Google? Tap one of the options below or type your answer.';

const DEFAULT_CLARIFICATION_SUGGESTIONS = [
  'Create product ad images',
  'Generate a video ad with HeyGen',
  'Post an ad to Meta',
  'Launch a Google Search campaign',
] as const;

export function normalizeIntentSuggestions(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const s = item.trim();
    if (!s || out.includes(s)) continue;
    out.push(s.slice(0, 120));
    if (out.length >= MAX_INTENT_SUGGESTIONS) break;
  }
  return out.length ? out : undefined;
}

export function buildIntentRoutingText(
  messages: Array<{ role: string; content?: string | null }>,
): string {
  return messages
    .filter((m) => m.role === 'USER' && m.content?.trim())
    .map((m) => m.content!.trim())
    .join('\n');
}

export async function runIntentClarificationTurn(input: {
  userText: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  clarificationQuestionsAsked: number;
}): Promise<IntentClarificationResult> {
  const forceRoute = input.clarificationQuestionsAsked >= MAX_INTENT_CLARIFICATION_QUESTIONS;

  const raw = await completeJsonChatWithHistory({
    model: CLASSIFIER_MODEL,
    system: SYSTEM,
    messages: [
      ...input.history.slice(-12),
      {
        role: 'user',
        content: `clarificationQuestionsAsked: ${input.clarificationQuestionsAsked}\nforceRouteNow: ${forceRoute}\n\nUser: ${input.userText}`,
      },
    ],
  });

  try {
    const parsed = responseSchema.parse(JSON.parse(raw));
    if (forceRoute || parsed.ready) {
      if (parsed.path) return { ready: true, path: parsed.path };
      throw new Error('missing path');
    }
    const reply = parsed.reply?.trim();
    if (!reply) throw new Error('missing reply');
    const suggestions =
      normalizeIntentSuggestions(parsed.suggestions) ?? [...DEFAULT_CLARIFICATION_SUGGESTIONS];
    return { ready: false, reply, suggestions };
  } catch {
    if (forceRoute) {
      const path = await classifyTopLevelPath(input.userText);
      return { ready: true, path };
    }
    return {
      ready: false,
      reply: DEFAULT_CLARIFICATION_REPLY,
      suggestions: [...DEFAULT_CLARIFICATION_SUGGESTIONS],
    };
  }
}
