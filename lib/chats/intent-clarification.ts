import 'server-only';

import { z } from 'zod';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { LLM_USER_REPLY_PRIVACY_RULES } from '@/lib/assistant/user-facing-llm-error';
import { CLASSIFIER_MODEL } from '@/lib/image-gen/models';

export const MAX_INTENT_CLARIFICATION_QUESTIONS = 2;

export type TopLevelPath = 'ads' | 'imageGen' | 'videoGen' | 'geo';

const responseSchema = z.object({
  ready: z.boolean(),
  path: z.enum(['ads', 'imageGen', 'videoGen', 'geo']).optional(),
  reply: z.string().optional(),
});

export type IntentClarificationResult =
  | { ready: true; path: TopLevelPath }
  | { ready: false; reply: string };

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

When intent is ambiguous between paths, set ready=false and ask ONE short, focused question in reply.
Examples of AMBIGUOUS intent (ask first):
- "I want to generate an ad" → could be image, video, or posting — ask whether they want a static image, a video, or to publish to Meta/Google.
- "Make me an ad" → ask what kind (image creative vs video vs launch campaign).
- "Help with ads" → ask if they want to create visuals, a video, or set up/publish a campaign.

Rules:
- Ask at most one question per turn when ready=false.
- Keep clarification questions concise and offer 2–3 concrete options when helpful.
- If clarificationQuestionsAsked is already ${MAX_INTENT_CLARIFICATION_QUESTIONS}, you MUST set ready=true and pick the best path from the full conversation — do not ask another question.
- When ready=true, reply must be omitted or empty.

${LLM_USER_REPLY_PRIVACY_RULES}

Respond JSON only:
{ "ready": boolean, "path"?: "ads" | "imageGen" | "videoGen" | "geo", "reply"?: string }`;

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
    return { ready: false, reply };
  } catch {
    if (forceRoute) {
      return { ready: true, path: inferPathFromText(input.userText) };
    }
    return {
      ready: false,
      reply:
        'Quick check — do you want to create a **static image ad**, a **video ad**, or **set up and publish** a campaign on Meta/Google?',
    };
  }
}

function inferPathFromText(text: string): TopLevelPath {
  const lower = text.toLowerCase();
  if (
    /geo\b|aeo\b|seo\b|citation|bounty|share of voice|geoknight|organic|get cited/.test(lower) &&
    !/meta pixel|facebook ad|campaign budget/.test(lower)
  ) {
    return 'geo';
  }
  if (/video|heygen|ugc|script/.test(lower) && !/image|photo|static/.test(lower)) {
    return 'videoGen';
  }
  if (/image|photo|variant|on model|visual|static/.test(lower) && !/video/.test(lower)) {
    return 'imageGen';
  }
  return 'ads';
}
