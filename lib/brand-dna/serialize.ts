import type {
  AudienceDna,
  CommunicationDna,
  ComplianceDna,
  VisualDna,
} from '@/app/generated/prisma/client';

function iso(d: Date) {
  return d.toISOString();
}

export function serializeVisualDna(row: VisualDna | null) {
  if (!row) return null;
  return {
    id: row.id,
    brandEntityId: row.brandEntityId,
    visualStyle: row.visualStyle,
    visualMaturity: row.visualMaturity,
    designComplexity: row.designComplexity,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    headingFont: row.headingFont,
    bodyFont: row.bodyFont,
    typographyPersonality: row.typographyPersonality,
    whitespaceLevel: row.whitespaceLevel,
    contentDensity: row.contentDensity,
    alignmentStyle: row.alignmentStyle,
    cornerRadiusStyle: row.cornerRadiusStyle,
    shadowStyle: row.shadowStyle,
    preferredVisualMotif: row.preferredVisualMotif,
    visualEmotion: row.visualEmotion,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeCommunicationDna(row: CommunicationDna | null) {
  if (!row) return null;
  return {
    id: row.id,
    brandEntityId: row.brandEntityId,
    tone: row.tone,
    voice: row.voice,
    brandPersonality: row.brandPersonality,
    emotionalIntensity: row.emotionalIntensity,
    headlineStyle: row.headlineStyle,
    ctaStyle: row.ctaStyle,
    urgencyLevel: row.urgencyLevel,
    socialProofUsage: row.socialProofUsage,
    primaryMessagingTheme: row.primaryMessagingTheme,
    secondaryMessagingTheme: row.secondaryMessagingTheme,
    avoidedMessagingTheme: row.avoidedMessagingTheme,
    readingLevel: row.readingLevel,
    avgSentenceLength: row.avgSentenceLength,
    paragraphDensity: row.paragraphDensity,
    activeVoicePercentage: row.activeVoicePercentage,
    positioningStatement: row.positioningStatement,
    valuePropositionStyle: row.valuePropositionStyle,
    differentiationStrategy: row.differentiationStrategy,
    introPattern: row.introPattern,
    storytellingPattern: row.storytellingPattern,
    conclusionPattern: row.conclusionPattern,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeAudienceDna(row: AudienceDna | null) {
  if (!row) return null;
  return {
    id: row.id,
    brandEntityId: row.brandEntityId,
    primaryPersona: row.primaryPersona,
    secondaryPersona: row.secondaryPersona,
    industryFocus: row.industryFocus,
    technicalLevel: row.technicalLevel,
    domainKnowledgeLevel: row.domainKnowledgeLevel,
    audiencePainPoints: row.audiencePainPoints,
    audienceMotivations: row.audienceMotivations,
    audienceObjections: row.audienceObjections,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function serializeComplianceDna(row: ComplianceDna | null) {
  if (!row) return null;
  return {
    id: row.id,
    brandEntityId: row.brandEntityId,
    bannedAbsoluteClaims: row.bannedAbsoluteClaims,
    bannedComparativeClaims: row.bannedComparativeClaims,
    allowedClaims: row.allowedClaims,
    bannedWords: row.bannedWords,
    allowedWords: row.allowedWords,
    fearBasedMarketingAllowed: row.fearBasedMarketingAllowed,
    sensationalLanguageAllowed: row.sensationalLanguageAllowed,
    politicalContentAllowed: row.politicalContentAllowed,
    religiousContentAllowed: row.religiousContentAllowed,
    controversialTopicsAllowed: row.controversialTopicsAllowed,
    sourceFileUrl: row.sourceFileUrl,
    sourceFileName: row.sourceFileName,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
