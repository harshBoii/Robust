export const ONBOARDING_STEPS = [
  'welcome',
  'company',
  'enriching',
  'brand-basics',
  'brand-audience',
  'facebook',
  'shopify',
  'guide-ads',
  'guide-aeo',
  'your-plan',
  'request-access',
  'request-password',
  'done',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type StartupPlan = {
  recommendedApproach: 'aeo_first' | 'ads_first' | 'balanced';
  headline: string;
  rationale: string[];
  evidence: { claim: string; source?: string }[];
  firstWeekActions: string[];
  metricsToWatch: string[];
};

export type DomainPreviewResult = {
  ok: boolean;
  domain: string;
  website: string;
  title: string | null;
  productLinkCount: number;
  colorCount: number;
  isShopify: boolean;
  message: string;
};

export type OnboardingCompanySnapshot = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  onboardingStep: string | null;
  accessStatus: string;
  accessRequestedAt: string | null;
  onboardingPlan: StartupPlan | null;
  brand: {
    id: string;
    canonicalName: string;
    industry: string | null;
    oneLiner: string | null;
    category: string | null;
    businessModel: string | null;
    targetAudiences: string[];
  } | null;
  integrations: {
    metaConnected: boolean;
    shopifyConnected: boolean;
    shopifyProductCount: number;
  };
};
