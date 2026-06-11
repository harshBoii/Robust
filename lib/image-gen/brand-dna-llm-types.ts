export type VisualDnaFields = {
  visualStyle?: string;
  visualMaturity?: string;
  designComplexity?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
  typographyPersonality?: string;
  whitespaceLevel?: string;
  contentDensity?: string;
  alignmentStyle?: string;
  cornerRadiusStyle?: string;
  shadowStyle?: string;
  preferredVisualMotif?: string;
  visualEmotion?: string;
};

export type CommunicationDnaFields = {
  tone?: string;
  voice?: string;
  brandPersonality?: string;
  emotionalIntensity?: string;
  headlineStyle?: string;
  ctaStyle?: string;
  urgencyLevel?: string;
  socialProofUsage?: string;
  primaryMessagingTheme?: string;
  secondaryMessagingTheme?: string;
  avoidedMessagingTheme?: string;
  readingLevel?: string;
  avgSentenceLength?: number;
  paragraphDensity?: string;
  activeVoicePercentage?: number;
  positioningStatement?: string;
  valuePropositionStyle?: string;
  differentiationStrategy?: string;
  introPattern?: string;
  storytellingPattern?: string;
  conclusionPattern?: string;
};

export type AudienceDnaFields = {
  primaryPersona?: string;
  secondaryPersona?: string;
  industryFocus?: string;
  technicalLevel?: string;
  domainKnowledgeLevel?: string;
  audiencePainPoints?: string[];
  audienceMotivations?: string[];
  audienceObjections?: string[];
};

export type ComplianceDnaFields = {
  bannedAbsoluteClaims?: string[];
  bannedComparativeClaims?: string[];
  allowedClaims?: string[];
  bannedWords?: string[];
  allowedWords?: string[];
  fearBasedMarketingAllowed: boolean;
  sensationalLanguageAllowed: boolean;
  politicalContentAllowed: boolean;
  religiousContentAllowed: boolean;
  controversialTopicsAllowed: boolean;
};

export type BrandDnaStructured = {
  brand: {
    name: string;
    tagline?: string;
    industry?: string;
    category?: string;
    targetAudiences: string[];
  };
  visual: VisualDnaFields | null;
  communication: CommunicationDnaFields | null;
  audience: AudienceDnaFields | null;
  compliance: ComplianceDnaFields | null;
};

export type BrandDnaLlmPackage = {
  structured: BrandDnaStructured;
  markdown: string;
  summary: string;
};
