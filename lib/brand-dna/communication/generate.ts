import 'server-only';

import { completeJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

import type { BrandProfileForDna } from '../build-brand-profile';
import type { communicationDnaUpsertSchema } from '../schemas';
import type { z } from 'zod';

const SYSTEM = `Based on the following brand profile, infer the most likely communication style.
Return a JSON object for only the fields you can confidently fill:
tone, voice, brandPersonality, emotionalIntensity, headlineStyle, ctaStyle, urgencyLevel,
socialProofUsage, primaryMessagingTheme, secondaryMessagingTheme, avoidedMessagingTheme.
Leave any field as null if you cannot infer it from the available context. Do not guess.
Respond with JSON only.`;

type CommunicationPartial = z.infer<typeof communicationDnaUpsertSchema>;

export async function generateCommunicationDna(
  profile: BrandProfileForDna,
): Promise<CommunicationPartial> {
  const raw = await completeJsonChat({
    model: 'gpt-5.4-mini',
    system: SYSTEM,
    user: `Brand profile: ${JSON.stringify(profile)}`,
  });
  return parseLlmJson<CommunicationPartial>(raw);
}
