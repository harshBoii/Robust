import 'server-only';

import type { IntelligenceResultRow } from '@/lib/asset-intelligence/intelligence-results';
import { completeJsonChat } from '@/lib/assistant/openai-json';

import { VIDEO_SCRIPT_MODEL } from './models';

const SYSTEM = `You are a performance creative strategist. Given asset intelligence from up to 3 top-performing video ads, synthesize ONE creative brief that distills winning patterns: hooks, emotional arc, pacing, visual patterns, messaging angle, and what to repeat in a new ad.

Keep the brief dense and actionable (under 500 words).

Respond with JSON only: { "brief": "..." }`;

export async function synthesizeBriefFromIntelligence(
  rows: IntelligenceResultRow[],
): Promise<string> {
  const payload = rows.map((r) => ({
    assetId: r.assetId,
    title: r.title,
    adName: r.adName,
    intelligence: r.intelligence,
  }));

  const raw = await completeJsonChat({
    model: VIDEO_SCRIPT_MODEL,
    system: SYSTEM,
    user: JSON.stringify(payload, null, 2),
  });
  const parsed = JSON.parse(raw) as { brief?: string };
  if (typeof parsed.brief === 'string' && parsed.brief.trim()) return parsed.brief.trim();
  return raw;
}
