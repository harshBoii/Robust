import type { Difficulty } from '@/app/generated/prisma/client';

export function rankFactor(latestRank: number | null, isMentioned: boolean): number {
  if (!isMentioned || latestRank == null) return 1;
  if (latestRank <= 3) return 0.2;
  if (latestRank <= 10) return 0.7;
  return 0.9;
}

export function difficultyFactor(difficulty: Difficulty | null | undefined): number {
  if (difficulty === 'EASY') return 1;
  if (difficulty === 'HARD') return 0.5;
  return 0.75;
}

export function reachNorm(estimatedReach: number | null | undefined, cap = 10_000): number {
  if (estimatedReach == null || estimatedReach <= 0) return 0;
  return Math.min(estimatedReach / cap, 1);
}

export function businessFitScore(
  query: string,
  offeringNames: string[],
  offeringKeywords: string[],
  brandKeywords: string[],
): number {
  const q = query.toLowerCase();
  const tokens = new Set(q.split(/\s+/).filter((t) => t.length > 2));
  if (tokens.size === 0) return 0.35;

  let hits = 0;
  let checks = 0;
  const haystacks = [...offeringNames, ...offeringKeywords, ...brandKeywords];
  for (const raw of haystacks) {
    const s = (raw ?? '').toLowerCase().trim();
    if (!s) continue;
    checks++;
    for (const tok of tokens) {
      if (s.includes(tok) || tok.includes(s)) {
        hits++;
        break;
      }
    }
  }
  if (checks === 0) return 0.35;
  return Math.min(1, hits / Math.min(checks, 6) + 0.15);
}

export type ActionType = 'quick_win' | 'defend' | 'long_bet' | 'maintain';

export function classifyAction(input: {
  latestRank: number | null;
  isMentioned: boolean;
  estimatedReach: number | null | undefined;
  difficulty: Difficulty | null | undefined;
  modelGapFlag: boolean;
}): ActionType {
  const { latestRank, isMentioned, estimatedReach, difficulty, modelGapFlag } = input;
  const reach = estimatedReach ?? 0;
  const hard = difficulty === 'HARD';
  const easy = difficulty === 'EASY';

  if (isMentioned && latestRank != null && latestRank <= 3) {
    if (modelGapFlag || hard) return 'defend';
    return 'maintain';
  }

  if (reach >= 2000 && easy && (!isMentioned || (latestRank != null && latestRank >= 4 && latestRank <= 10))) {
    return 'quick_win';
  }

  if (hard && reach >= 1500 && (!isMentioned || (latestRank != null && latestRank > 5))) {
    return 'long_bet';
  }

  if (!isMentioned || (latestRank != null && latestRank > 3)) {
    return 'quick_win';
  }

  return 'maintain';
}

export function opportunityScore(input: {
  latestRank: number | null;
  isMentioned: boolean;
  estimatedReach: number | null | undefined;
  confidence: number | null | undefined;
  difficulty: Difficulty | null | undefined;
  businessFit: number;
  reachCap?: number;
}): number {
  const conf = input.confidence != null && input.confidence > 0 ? input.confidence / 100 : 0.5;
  const rCap = input.reachCap ?? 10_000;
  const rn = reachNorm(input.estimatedReach, rCap);
  const rf = rankFactor(input.latestRank, input.isMentioned);
  const df = difficultyFactor(input.difficulty);
  return 100 * rf * rn * conf * input.businessFit * df;
}

export function promptEstimatedRevenue(input: {
  estimatedReach: number | null | undefined;
  ctr: number;
  cvr: number;
  aovProxy: number | null | undefined;
  aovMultiplier: number;
}): number | null {
  const reach = input.estimatedReach;
  if (reach == null || reach <= 0) return null;
  const aov = input.aovProxy;
  if (aov == null || aov <= 0) return null;
  const rev = reach * input.ctr * input.cvr * aov * input.aovMultiplier;
  return Number.isFinite(rev) ? rev : null;
}

/** WRS weight: rank 1→1, 2→0.5, 3→0.33, n→1/n */
export function wrsWeightForRank(rank: number | null | undefined): number {
  if (rank == null || rank < 1) return 0;
  if (rank === 1) return 1;
  if (rank === 2) return 0.5;
  if (rank === 3) return 0.33;
  return 1 / rank;
}
