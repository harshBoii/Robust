export type VisualDnaDto = {
  id?: string;
  brandEntityId?: string;
  visualStyle?: string | null;
  visualMaturity?: string | null;
  designComplexity?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  typographyPersonality?: string | null;
  whitespaceLevel?: string | null;
  contentDensity?: string | null;
  alignmentStyle?: string | null;
  cornerRadiusStyle?: string | null;
  shadowStyle?: string | null;
  preferredVisualMotif?: string | null;
  visualEmotion?: string | null;
};

export type CommunicationDnaDto = {
  id?: string;
  brandEntityId?: string;
  tone?: string | null;
  voice?: string | null;
  brandPersonality?: string | null;
  emotionalIntensity?: string | null;
  headlineStyle?: string | null;
  ctaStyle?: string | null;
  urgencyLevel?: string | null;
  socialProofUsage?: string | null;
  primaryMessagingTheme?: string | null;
  secondaryMessagingTheme?: string | null;
  avoidedMessagingTheme?: string | null;
  readingLevel?: string | null;
  avgSentenceLength?: number | null;
  paragraphDensity?: string | null;
  activeVoicePercentage?: number | null;
  positioningStatement?: string | null;
  valuePropositionStyle?: string | null;
  differentiationStrategy?: string | null;
  introPattern?: string | null;
  storytellingPattern?: string | null;
  conclusionPattern?: string | null;
};

export type AudienceDnaDto = {
  id?: string;
  brandEntityId?: string;
  primaryPersona?: string | null;
  secondaryPersona?: string | null;
  industryFocus?: string | null;
  technicalLevel?: string | null;
  domainKnowledgeLevel?: string | null;
  audiencePainPoints?: string[];
  audienceMotivations?: string[];
  audienceObjections?: string[];
};

export type ComplianceDnaDto = {
  id?: string;
  brandEntityId?: string;
  bannedAbsoluteClaims?: string[];
  bannedComparativeClaims?: string[];
  allowedClaims?: string[];
  bannedWords?: string[];
  allowedWords?: string[];
  fearBasedMarketingAllowed?: boolean;
  sensationalLanguageAllowed?: boolean;
  politicalContentAllowed?: boolean;
  religiousContentAllowed?: boolean;
  controversialTopicsAllowed?: boolean;
  sourceFileUrl?: string | null;
  sourceFileName?: string | null;
};

export type DnaTabId = 'overview' | 'visual' | 'communication' | 'audience' | 'compliance';
