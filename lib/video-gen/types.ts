export type VideoGenSubpath = 'mrAdicasso' | 'learnAndBuild' | 'replicate';

export type VideoGenDurationBucket = 'short' | 'medium' | 'long';

export type VideoGenAdCategory =
  | 'beforeAfter'
  | 'pov'
  | 'ugc'
  | 'productReview'
  | 'discountOffer'
  | 'directComparison'
  | 'qa'
  | 'painPoint'
  | 'trendInduced';

export const VIDEO_GEN_AD_CATEGORIES: Array<{
  id: VideoGenAdCategory;
  label: string;
}> = [
  { id: 'beforeAfter', label: 'Before & After' },
  { id: 'pov', label: 'POV' },
  { id: 'ugc', label: 'UGC' },
  { id: 'productReview', label: 'Product Review' },
  { id: 'discountOffer', label: 'Discount / Offer Ad' },
  { id: 'directComparison', label: 'Direct Comparison Ad' },
  { id: 'qa', label: 'Q&A Ad' },
  { id: 'painPoint', label: 'Pain Point Ad' },
  { id: 'trendInduced', label: 'Trend-Induced Ad' },
];

export type VideoGenStep =
  | 'routing'
  | 'offeringPick'
  | 'adTypePick'
  | 'trendPick'
  | 'durationInput'
  | 'generatingScript'
  | 'reviewScript'
  | 'fetchTopAds'
  | 'analyzingAds'
  | 'adLibraryPick'
  | 'runningIntel'
  | 'heygenGenerating'
  | 'heygenPolling'
  | 'done';

export type VideoGenCompanyContext = {
  brand: {
    name: string;
    oneLiner: string | null;
    about: string | null;
    industry: string | null;
    category: string | null;
    topics: string[];
    keywords: string[];
    targetAudiences: string[];
    toneOfVoice: string | null;
    brandValues: string[];
    positioningStatement: string | null;
    visualIdentityNotes: string | null;
  };
  offerings: Array<{
    id: string;
    name: string;
    description: string | null;
    offeringType: string;
    keywords: string[];
    useCases: string[];
    targetAudiences: string[];
    differentiators: string[];
    isPrimary: boolean;
  }>;
  selectedOffering: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    targetAudience: string[];
    keyBenefits: string[];
    usp: string[];
    pricingTier: string | null;
  } | null;
};

export type VideoGenState = {
  subpath: VideoGenSubpath;
  step: VideoGenStep;
  offeringId?: string;
  companyContext?: VideoGenCompanyContext;
  adCategory?: VideoGenAdCategory;
  trendTopic?: string;
  durationBucket?: VideoGenDurationBucket;
  adScript?: string;
  /** Server-only in DB; stripped before API responses to client. */
  directorPrompt?: string;
  topAssetIds?: string[];
  intelligenceBrief?: string;
  replicateAssetId?: string;
  heygenJobId?: string;
  generatedAssetId?: string;
  changeTurns?: number;
  agentMemory?: string;
  lastError?: string | null;
};

export type VideoGenActionType =
  | 'videoGen.subpathChosen'
  | 'videoGen.offeringSelected'
  | 'videoGen.adTypeSelected'
  | 'videoGen.trendSubmitted'
  | 'videoGen.scriptApproved'
  | 'videoGen.scriptChangeRequested'
  | 'videoGen.adSelected'
  | 'videoGen.retryIntel';

export const VIDEO_GEN_ACTIONS: VideoGenActionType[] = [
  'videoGen.subpathChosen',
  'videoGen.offeringSelected',
  'videoGen.adTypeSelected',
  'videoGen.trendSubmitted',
  'videoGen.scriptApproved',
  'videoGen.scriptChangeRequested',
  'videoGen.adSelected',
  'videoGen.retryIntel',
];

export type VideoGenWidgetType =
  | 'videoGenSubpathChoice'
  | 'videoGenOfferingPicker'
  | 'videoGenAdTypePicker'
  | 'videoGenScriptReview'
  | 'videoGenAdLibraryPicker'
  | 'videoGenAnalyzing'
  | 'videoGenGenerating'
  | 'videoGenHeygenProgress'
  | 'videoGenDone';
