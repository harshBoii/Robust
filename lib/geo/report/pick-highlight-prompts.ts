import type { TopicView } from '@/lib/geo/geoknight/types';

export type HighlightPrompt = TopicView['prompts'][number] & { topicName: string };

/** Prefer comparison-style prompts; otherwise prompts with both consensus and per-model rows. */
export function pickHighlightPrompts(topics: TopicView[]): HighlightPrompt[] {
  const all = topics.flatMap((t) => t.prompts.map((p) => ({ ...p, topicName: t.name })));
  const vs = all.filter((p) => /\bvs\b|compare/i.test(p.query));
  if (vs.length) return vs.slice(0, 3);
  const rich = all.filter((p) => (p.consensus?.length ?? 0) > 0 && (p.byModel?.length ?? 0) > 0);
  rich.sort((a, b) => (b.consensus?.length ?? 0) - (a.consensus?.length ?? 0));
  return rich.slice(0, 3);
}
