import { z } from 'zod';

const optionalString = z.string().trim().max(2000).optional().nullable();
const optionalShort = z.string().trim().max(255).optional().nullable();
const stringArray = z.array(z.string().trim()).optional();
const optionalInt = z.number().int().optional().nullable();

export const visualDnaUpsertSchema = z.object({
  visualStyle: optionalShort,
  visualMaturity: optionalShort,
  designComplexity: optionalShort,
  primaryColor: z.string().trim().max(32).optional().nullable(),
  secondaryColor: z.string().trim().max(32).optional().nullable(),
  accentColor: z.string().trim().max(32).optional().nullable(),
  backgroundColor: z.string().trim().max(32).optional().nullable(),
  headingFont: optionalShort,
  bodyFont: optionalShort,
  typographyPersonality: optionalShort,
  whitespaceLevel: optionalShort,
  contentDensity: optionalShort,
  alignmentStyle: optionalShort,
  cornerRadiusStyle: optionalShort,
  shadowStyle: optionalShort,
  preferredVisualMotif: optionalShort,
  visualEmotion: optionalShort,
});

export const communicationDnaUpsertSchema = z.object({
  tone: optionalShort,
  voice: optionalShort,
  brandPersonality: optionalShort,
  emotionalIntensity: optionalShort,
  headlineStyle: optionalShort,
  ctaStyle: optionalShort,
  urgencyLevel: optionalShort,
  socialProofUsage: optionalShort,
  primaryMessagingTheme: optionalString,
  secondaryMessagingTheme: optionalString,
  avoidedMessagingTheme: optionalString,
  readingLevel: optionalShort,
  avgSentenceLength: optionalInt,
  paragraphDensity: optionalShort,
  activeVoicePercentage: z.number().int().min(0).max(100).optional().nullable(),
  positioningStatement: optionalString,
  valuePropositionStyle: optionalShort,
  differentiationStrategy: optionalShort,
  introPattern: optionalShort,
  storytellingPattern: optionalShort,
  conclusionPattern: optionalShort,
});

export const audienceDnaUpsertSchema = z.object({
  primaryPersona: optionalShort,
  secondaryPersona: optionalShort,
  industryFocus: optionalShort,
  technicalLevel: optionalShort,
  domainKnowledgeLevel: optionalShort,
  audiencePainPoints: stringArray,
  audienceMotivations: stringArray,
  audienceObjections: stringArray,
});

export const complianceDnaUpsertSchema = z.object({
  bannedAbsoluteClaims: stringArray,
  bannedComparativeClaims: stringArray,
  allowedClaims: stringArray,
  bannedWords: stringArray,
  allowedWords: stringArray,
  fearBasedMarketingAllowed: z.boolean().optional(),
  sensationalLanguageAllowed: z.boolean().optional(),
  politicalContentAllowed: z.boolean().optional(),
  religiousContentAllowed: z.boolean().optional(),
  controversialTopicsAllowed: z.boolean().optional(),
  sourceFileUrl: z.string().trim().max(2000).optional().nullable(),
  sourceFileName: z.string().trim().max(500).optional().nullable(),
});

export const visualGenerateSchema = z.object({
  landingPageUrl: z.string().trim().min(1).max(2000),
});

export const analyzeBlogsSchema = z.object({
  blogUrls: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
});
