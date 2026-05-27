import type { BountyDifficulty } from '@/app/generated/prisma/client';
import { DEFAULT_BOUNTY_CONVERSION_RATE } from './constants';

export function effectiveBountyConversionRate(stored: number | null | undefined): number {
  if (stored != null && Number.isFinite(stored) && stored > 0) return stored;
  return DEFAULT_BOUNTY_CONVERSION_RATE;
}

export function computeBountyEstimatedRevenue(input: {
  estimatedReach: number | null | undefined;
  conversionRate: number | null | undefined;
  avgOrderValue: number | null | undefined;
}): number | null {
  const reach = input.estimatedReach;
  if (reach == null || reach <= 0) return null;
  const conv = effectiveBountyConversionRate(input.conversionRate);
  const aov = input.avgOrderValue;
  if (aov == null || aov <= 0 || !Number.isFinite(aov)) return null;
  const rev = reach * conv * aov;
  return Number.isFinite(rev) ? rev : null;
}

export function bountyPriorityScore(input: {
  estimatedReach: number | null | undefined;
  confidence: number;
  difficulty: BountyDifficulty;
}): number {
  const w = input.difficulty === 'EASY' ? 1 : input.difficulty === 'MEDIUM' ? 2 : 4;
  const reach = input.estimatedReach ?? 0;
  if (reach <= 0) return 0;
  return (reach * input.confidence) / w;
}
