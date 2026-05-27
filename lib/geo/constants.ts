/** D2C-style default when `CitationBounty.conversionRate` is null */
export const DEFAULT_BOUNTY_CONVERSION_RATE = 0.025;

/** Default CTR / CVR for prompt-level revenue when no RadarAssumption row exists */
export const DEFAULT_CTR = 0.02;
export const DEFAULT_CVR = 0.025;

export const REACH_CAP = 10_000;

export const TOP3_BENCHMARK_PCT = 70;

export const BOUNTY_DIFFICULTY_WEIGHT: Record<string, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 4,
};
