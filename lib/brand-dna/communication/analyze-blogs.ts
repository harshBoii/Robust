import 'server-only';

import { completeJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

import { concatenateArticleTexts, scrapeArticleTexts } from '../scrape-article';
import type { communicationDnaUpsertSchema } from '../schemas';
import type { z } from 'zod';

const SYSTEM = `Analyze the following blog content from a brand and extract writing style metrics.
Return JSON with:
readingLevel (Flesch-Kincaid grade label e.g. Grade 6),
avgSentenceLength (integer average words per sentence),
paragraphDensity (Dense / Airy / Mixed),
activeVoicePercentage (0-100 estimate),
positioningStatement (one sentence),
valuePropositionStyle (Feature-led / Outcome-led / Emotion-led),
differentiationStrategy (Price / Quality / Niche / Community / Innovation),
introPattern (Problem First / Story First / Data First / Bold Claim / Question),
storytellingPattern (Hero's Journey / Before-After-Bridge / Case Study / Educational / Listicle),
conclusionPattern (CTA Push / Reflective Close / Summary + Next Step / Open Loop).
Use null for fields you cannot determine. Respond with JSON only.`;

type BlogAnalysisPartial = Pick<
  z.infer<typeof communicationDnaUpsertSchema>,
  | 'readingLevel'
  | 'avgSentenceLength'
  | 'paragraphDensity'
  | 'activeVoicePercentage'
  | 'positioningStatement'
  | 'valuePropositionStyle'
  | 'differentiationStrategy'
  | 'introPattern'
  | 'storytellingPattern'
  | 'conclusionPattern'
>;

export async function analyzeBlogsForCommunicationDna(
  blogUrls: string[],
): Promise<BlogAnalysisPartial> {
  const texts = await scrapeArticleTexts(blogUrls);
  if (!texts.length) {
    throw new Error('Could not extract text from any of the provided blog URLs.');
  }

  const combined = concatenateArticleTexts(texts);
  const raw = await completeJsonChat({
    model: 'gpt-5.4-mini',
    system: SYSTEM,
    user: `Blog content:\n\n${combined}`,
  });
  return parseLlmJson<BlogAnalysisPartial>(raw);
}
