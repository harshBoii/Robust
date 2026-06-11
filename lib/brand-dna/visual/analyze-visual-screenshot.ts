import 'server-only';

import { completeVisionJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

const SYSTEM = `Analyze this landing page screenshot. Return a JSON object with:
- visual_style (one word, e.g. Minimal, Bold, Organic, Corporate)
- visual_maturity (e.g. Polished, Emerging, Rough)
- design_complexity (High, Medium, or Low)
- preferred_visual_motif (one of: Nature, Tech, People, Abstract, Lifestyle, Minimal, Pattern)
- visual_emotion (one of: Trust, Excitement, Calm, Premium, Playful, Bold, Friendly)
- typography_personality (one word describing the typographic feel)

Respond with JSON only.`;

export type VisionVisualAnalysis = {
  visual_style?: string | null;
  visual_maturity?: string | null;
  design_complexity?: string | null;
  preferred_visual_motif?: string | null;
  visual_emotion?: string | null;
  typography_personality?: string | null;
};

export async function analyzeVisualScreenshot(screenshotBase64: string): Promise<VisionVisualAnalysis> {
  const raw = await completeVisionJsonChat({
    system: SYSTEM,
    userText: 'Analyze this landing page screenshot and return the JSON fields.',
    imageUrls: [`data:image/png;base64,${screenshotBase64}`],
  });
  return parseLlmJson<VisionVisualAnalysis>(raw);
}
