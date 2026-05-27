import type { GeoKnightWorkspaceData } from '@/lib/geo/geoknight/loadGeoKnightTopicViews';

type TopicAuthorityMapItem = {
  topicId: string;
  topicName: string;
  difficulty: string;
  promptCount: number;
  companyName?: string | null;
};

export type TopicAuthorityRowView = TopicAuthorityMapItem & {
  total: number;
  hunted: number;
  completionPct: number;
  score: number;
};

function topicTierMultiplier(n: number): number {
  if (n <= 5) return 20;
  if (n <= 9) return 35;
  if (n <= 20) return 50;
  if (n <= 50) return 75;
  return 100;
}

export function topicAuthorityScore(totalPrompts: number, completedPrompts: number): number {
  const completion = totalPrompts > 0 ? completedPrompts / totalPrompts : 0;
  return Math.max(10, Math.min(100, Math.round(topicTierMultiplier(totalPrompts) * completion)));
}

export function buildTopicAuthorityRows(
  topicAuthorityMap: TopicAuthorityMapItem[],
  geoKnight: GeoKnightWorkspaceData,
): TopicAuthorityRowView[] {
  const totalPromptsByTopic = new Map<string, number>();
  for (const t of geoKnight.topicViews) totalPromptsByTopic.set(t.id, t.prompts.length);

  const huntedPromptsByTopic = new Map<string, number>();
  for (const t of geoKnight.topicViews) {
    huntedPromptsByTopic.set(t.id, t.prompts.filter((p) => p.ishunted).length);
  }

  return topicAuthorityMap
    .map((t) => {
      const total = totalPromptsByTopic.get(t.topicId) ?? t.promptCount;
      const hunted = Math.min(huntedPromptsByTopic.get(t.topicId) ?? 0, total);
      const completionPct = total > 0 ? Math.round((hunted / total) * 100) : 0;
      const score = topicAuthorityScore(total, hunted);
      return { ...t, total, hunted, completionPct, score };
    })
    .sort((a, b) => b.score - a.score);
}
