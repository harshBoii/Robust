export type PromptRevenueView = {
  estimatedRevenue: number | null;
  monthlyPromptReach: number | null;
  visibilityWeight: number | null;
  ctr: number | null;
  cvr: number | null;
  aov: number | null;
} | null;

export type PromptView = {
  id: string;
  query: string;
  reason: string | null;
  createdAt: string;
  ishunted: boolean;
  revenue: PromptRevenueView;
  consensus: Array<{ companyName: string; avgRank: number | null; mentions: number }>;
  byModel: Array<{ model: string; companyName: string; rank: number | null }>;
};

export type TopicView = {
  id: string;
  name: string;
  reason: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  createdAt: string;
  prompts: PromptView[];
};

export type RivalCompanyView = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
};

export type InsightTopicInput = {
  name: string;
  prompts: Array<{
    query: string;
    consensus: Array<{ companyName: string; avgRank: number | null; mentions: number }>;
    byModel: Array<{ model: string; companyName: string; rank: number | null }>;
  }>;
};
