import 'server-only';

import { completeJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

import type { BrandProfileForDna } from '../build-brand-profile';
import type { audienceDnaUpsertSchema } from '../schemas';
import type { z } from 'zod';

const SYSTEM = `Based on the following brand profile, infer the most likely target audience profile.
Return a JSON object for only the fields you can confidently fill:
primaryPersona (short phrase), secondaryPersona, industryFocus,
technicalLevel (Beginner / Intermediate / Expert),
domainKnowledgeLevel (Low / Medium / High),
audiencePainPoints (array of 3-5 strings),
audienceMotivations (array of 3-5 strings),
audienceObjections (array of 3-5 strings).
Leave fields as null or empty arrays if you cannot infer them. Do not guess.
Respond with JSON only.`;

type AudiencePartial = z.infer<typeof audienceDnaUpsertSchema>;

export async function generateAudienceDna(profile: BrandProfileForDna): Promise<AudiencePartial> {
  const raw = await completeJsonChat({
    model: 'gpt-5.4-mini',
    system: SYSTEM,
    user: `Brand profile: ${JSON.stringify(profile)}`,
  });
  return parseLlmJson<AudiencePartial>(raw);
}
