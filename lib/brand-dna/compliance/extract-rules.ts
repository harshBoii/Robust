import 'server-only';

import { completeJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

import type { complianceDnaUpsertSchema } from '../schemas';
import type { z } from 'zod';

const SYSTEM = `Extract compliance rules from the following brand/legal document.
Return JSON with:
bannedAbsoluteClaims (string array),
bannedComparativeClaims (string array),
allowedClaims (string array),
bannedWords (string array),
allowedWords (string array),
fearBasedMarketingAllowed (boolean or null),
sensationalLanguageAllowed (boolean or null),
politicalContentAllowed (boolean or null),
religiousContentAllowed (boolean or null),
controversialTopicsAllowed (boolean or null).
If a field cannot be determined, use null for booleans and empty arrays for lists.
Respond with JSON only.`;

type CompliancePartial = z.infer<typeof complianceDnaUpsertSchema>;

export async function extractComplianceRulesFromText(text: string): Promise<CompliancePartial> {
  const truncated = text.length > 100_000 ? text.slice(0, 100_000) : text;
  const raw = await completeJsonChat({
    model: 'gpt-5.4-mini',
    system: SYSTEM,
    user: `Document text:\n\n${truncated}`,
  });
  return parseLlmJson<CompliancePartial>(raw);
}
