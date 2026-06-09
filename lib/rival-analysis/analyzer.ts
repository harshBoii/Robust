import 'server-only';

import OpenAI from 'openai';

import type { ScrapedAd } from './scraper';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VISION_MODEL = 'gpt-5.4-mini';

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString('base64');
  } catch {
    return null;
  }
}

/** Pick the highest-res image from an ad's image array (also used as the card thumbnail) */
export function pickBestImage(images: string[]): string | null {
  if (!images.length) return null;
  return (
    images.find(x => x.includes('s600x600')) ??
    images.find(x => x.includes('s300x300')) ??
    images[0]
  );
}

const PER_AD_ANALYSIS_PROMPT = (idx: number) => `
Analyze ONLY AD #${idx}.

FIRST LINE MUST BE:
IMAGE_VISIBLE: YES
or
IMAGE_VISIBLE: NO

If IMAGE_VISIBLE: YES provide:
1. Detailed visual description
2. People shown
3. Products shown
4. Colors used
5. Text overlays visible in image
6. Visual hook
7. Creative type
8. Emotional triggers
9. Offer structure
10. Target audience
11. Why this creative is likely profitable
12. What should be copied
13. Weaknesses
14. What can be learned from the visual itself

If IMAGE_VISIBLE: NO, explain exactly why.
`;

const SUMMARY_PROMPT = `
You have now analyzed all the ads.

Create a FINAL COMPETITIVE INTELLIGENCE SUMMARY. Return valid markdown.

Include:

# Brand Positioning

# Winning Hooks

# Winning Visual Patterns

# Winning Offers

# Audience Patterns

# Most Effective Creative Types

# Creative Gaps To Exploit

# New Ad Angles To Test

# Recommendations

For visual conclusions, ONLY use visuals you actually saw. Do not guess.
`;

export interface AdAnalysisResult {
  perAdAnalysis: string[];
  summary: string;
  imageVisible: boolean[];
}

export async function analyzeAds(ads: ScrapedAd[]): Promise<AdAnalysisResult> {
  const perAdAnalysis: string[] = [];
  const imageVisible: boolean[] = [];

  // Analyse each ad individually so we stay within token limits
  for (let idx = 0; idx < ads.length; idx++) {
    const ad = ads[idx];
    const adNum = idx + 1;

    const contextText = `
AD #${adNum}

Library ID: ${ad.library_id}
Days Running: ${ad.days_running ?? 'unknown'}
Start Date: ${ad.start_date ?? 'unknown'}
Status: ${ad.status}
CTA: ${ad.cta ?? 'none'}

Landing URLs:
${JSON.stringify(ad.landing_urls.slice(0, 5), null, 2)}

Ad Copy:
${(ad.ad_copy ?? ad.raw_text ?? '').slice(0, 2500)}
`;

    const imageUrl = pickBestImage(ad.images);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (imageUrl) {
      const b64 = await fetchImageAsBase64(imageUrl);
      if (b64) {
        const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: 'text', text: contextText },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
          { type: 'text', text: PER_AD_ANALYSIS_PROMPT(adNum) },
        ];
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: `${contextText}\n\nIMAGE_VISIBLE: NO\nCould not fetch image.\n\n${PER_AD_ANALYSIS_PROMPT(adNum)}` });
      }
    } else {
      messages.push({ role: 'user', content: `${contextText}\n\nIMAGE_VISIBLE: NO\nNo image available.\n\n${PER_AD_ANALYSIS_PROMPT(adNum)}` });
    }

    try {
      const res = await openai.chat.completions.create({
        model: VISION_MODEL,
        messages,
      });
      const text = res.choices[0]?.message?.content ?? '';
      perAdAnalysis.push(text);
      imageVisible.push(text.includes('IMAGE_VISIBLE: YES'));
    } catch (err) {
      const msg = `IMAGE_VISIBLE: NO\nError during analysis: ${err instanceof Error ? err.message : String(err)}`;
      perAdAnalysis.push(msg);
      imageVisible.push(false);
    }
  }

  // Build summary using all per-ad analyses
  const summaryUserContent = ads
    .map((ad, i) => `AD #${i + 1} (Library ID: ${ad.library_id}, Days running: ${ad.days_running ?? '?'}):\n${perAdAnalysis[i]}`)
    .join('\n\n---\n\n');

  let summary = '';
  try {
    const res = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: 'user', content: summaryUserContent + '\n\n' + SUMMARY_PROMPT },
      ],
    });
    summary = res.choices[0]?.message?.content ?? '';
  } catch (err) {
    summary = `# Analysis Error\n\nCould not generate summary: ${err instanceof Error ? err.message : String(err)}`;
  }

  return { perAdAnalysis, summary, imageVisible };
}
