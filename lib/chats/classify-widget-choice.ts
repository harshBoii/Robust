import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';
import { CLASSIFIER_MODEL } from '@/lib/image-gen/models';

export type WidgetChoiceOption = {
  optionId: string;
  label: string;
  description?: string;
};

const decisionSchema = z.object({
  matched: z.boolean(),
  optionId: z.string().optional(),
});

export async function classifyWidgetChoice(input: {
  userText: string;
  stepDescription: string;
  options: WidgetChoiceOption[];
}): Promise<{ matched: boolean; optionId?: string }> {
  if (!input.options.length) return { matched: false };

  const fallback = fallbackWidgetChoiceMatch(input.userText, input.options);
  if (fallback) return { matched: true, optionId: fallback };

  const optionList = input.options
    .map(
      (o) =>
        `- ${o.optionId}: ${o.label}${o.description ? ` — ${o.description}` : ''}`,
    )
    .join('\n');

  const system = `The user typed a message instead of clicking a UI button. Decide if their message clearly selects ONE of these options.

Step: ${input.stepDescription}

Options (use optionId exactly when matching):
${optionList}

Rules:
- Match synonyms, partial names, and obvious paraphrases (e.g. "urban" → Urban street).
- If they want to upload their own image and __upload__ exists, match __upload__.
- If ambiguous, unrelated, or a question, set matched false.

Respond JSON only: { "matched": boolean, "optionId"?: string }`;

  const raw = await completeJsonChat({
    model: CLASSIFIER_MODEL,
    system,
    user: input.userText,
  });

  try {
    const parsed = decisionSchema.parse(JSON.parse(raw));
    if (!parsed.matched || !parsed.optionId) return { matched: false };
    const ok = input.options.some((o) => o.optionId === parsed.optionId);
    if (!ok) return { matched: false };
    return { matched: true, optionId: parsed.optionId };
  } catch {
    return fallback
      ? { matched: true, optionId: fallback }
      : { matched: false };
  }
}

function normalizeChoiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackWidgetChoiceMatch(
  userText: string,
  options: WidgetChoiceOption[],
): string | undefined {
  const lower = normalizeChoiceText(userText);
  if (!lower || lower.length < 2) return undefined;

  for (const o of options) {
    const label = normalizeChoiceText(o.label);
    if (lower === label || lower.includes(label) || label.includes(lower)) {
      return o.optionId;
    }
  }

  for (const o of options) {
    const label = normalizeChoiceText(o.label);
    const words = label.split(' ').filter((w) => w.length > 3);
    if (words.length && words.every((w) => lower.includes(w))) {
      return o.optionId;
    }
  }

  if (/upload|my own|custom|bring my/.test(lower)) {
    const upload = options.find((o) => o.optionId === '__upload__');
    if (upload) return upload.optionId;
  }

  return undefined;
}
