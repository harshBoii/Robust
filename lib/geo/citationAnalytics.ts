import type { Difficulty } from '@/app/generated/prisma/client';
import { wrsWeightForRank } from './scoring';

export type ExecutionLite = {
  id: string;
  model: string;
  executedAt: Date;
  promptId: string;
  citations: Array<{ companyId: string | null; rank: number | null; context: string | null }>;
};

export type PromptCitationStats = {
  promptId: string;
  query: string;
  topicId: string | null;
  topicName: string | null;
  topicDifficulty: Difficulty | null;
  executionCount: number;
  winRate: number;
  wrs: number;
  modelsCitingCount: number;
  distinctModelTotal: number;
  contextDistribution: Array<{ label: string; count: number; pct: number }>;
};

function normalizeContextLabel(raw: string | null | undefined): string {
  if (raw == null || !raw.trim()) return 'unknown';
  const s = raw.trim().toLowerCase();
  if (s.includes('solution') || s.includes('recommend')) return 'solution';
  if (s.includes('compare') || s.includes('vs')) return 'comparison';
  if (s.includes('mention')) return 'mention';
  return raw.trim().slice(0, 40);
}

export function aggregatePromptStats(
  promptId: string,
  query: string,
  topicId: string | null,
  topicName: string | null,
  topicDifficulty: Difficulty | null,
  executions: ExecutionLite[],
  companyId: string | readonly string[],
): PromptCitationStats {
  const ownSet = typeof companyId === 'string' ? new Set([companyId]) : new Set(companyId);
  const distinctModels = new Set(executions.map((e) => e.model));
  let wins = 0;
  let wrsSum = 0;
  const modelsWithUs = new Set<string>();
  const contextBuckets = new Map<string, number>();

  for (const ex of executions) {
    const ours = ex.citations.filter((c) => c.companyId != null && ownSet.has(c.companyId));
    if (ours.length > 0) {
      wins++;
      modelsWithUs.add(ex.model);
      const bestRank = Math.min(...ours.map((c) => (c.rank != null && c.rank > 0 ? c.rank : 99)));
      const rankForWrs = bestRank < 99 ? bestRank : null;
      wrsSum += wrsWeightForRank(rankForWrs);
      for (const c of ours) {
        const label = normalizeContextLabel(c.context);
        contextBuckets.set(label, (contextBuckets.get(label) ?? 0) + 1);
      }
    }
  }

  const executionCount = executions.length;
  const winRate = executionCount > 0 ? (wins / executionCount) * 100 : 0;
  const wrs = wins > 0 ? wrsSum / wins : 0;

  const ctxTotal = [...contextBuckets.values()].reduce((a, b) => a + b, 0);
  const contextDistribution = [...contextBuckets.entries()]
    .map(([label, count]) => ({
      label,
      count,
      pct: ctxTotal > 0 ? Math.round((count / ctxTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    promptId,
    query,
    topicId,
    topicName,
    topicDifficulty,
    executionCount,
    winRate,
    wrs,
    modelsCitingCount: modelsWithUs.size,
    distinctModelTotal: distinctModels.size,
    contextDistribution,
  };
}

export type TopicAuthorityRow = {
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
  promptCount: number;
  avgWinRate: number;
  quadrant: 'defend' | 'attack_first' | 'long_bet' | 'maintain';
  companyName?: string | null;
};

export function topicAuthorityFromRollup(
  topicId: string,
  topicName: string,
  difficulty: Difficulty,
  promptStats: PromptCitationStats[],
): TopicAuthorityRow {
  const relevant = promptStats.filter((p) => p.topicId === topicId);
  const avgWinRate =
    relevant.length > 0 ? relevant.reduce((s, p) => s + p.winRate, 0) / relevant.length : 0;

  let quadrant: TopicAuthorityRow['quadrant'] = 'maintain';
  const hard = difficulty === 'HARD';
  const easy = difficulty === 'EASY';
  if (avgWinRate >= 55 && hard) quadrant = 'defend';
  else if (avgWinRate < 45 && easy) quadrant = 'attack_first';
  else if (avgWinRate < 40 && hard) quadrant = 'long_bet';

  return {
    topicId,
    topicName,
    difficulty,
    promptCount: relevant.length,
    avgWinRate,
    quadrant,
  };
}
