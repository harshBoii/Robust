import 'server-only';

import type {
  AudienceDna,
  BrandEntity,
  CommunicationDna,
  ComplianceDna,
  Offering,
  VisualDna,
} from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import type {
  AudienceDnaFields,
  BrandDnaLlmPackage,
  BrandDnaStructured,
  CommunicationDnaFields,
  ComplianceDnaFields,
  VisualDnaFields,
} from './brand-dna-llm-types';
import type { ImageGenState } from './types';

function brandingField(branding: unknown, key: string): string | null {
  if (!branding || typeof branding !== 'object') return null;
  const v = (branding as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function pickStringFields<T extends Record<string, unknown>>(
  row: T,
  keys: (keyof T)[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) {
      out[key] = v.trim() as T[keyof T];
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v as T[keyof T];
    }
  }
  return out;
}

function pickStringArray(arr: string[] | undefined | null): string[] | undefined {
  const filtered = (arr ?? []).map((s) => s.trim()).filter(Boolean);
  return filtered.length ? filtered : undefined;
}

function toVisualFields(row: VisualDna | null): VisualDnaFields | null {
  if (!row) return null;
  const fields = pickStringFields(row as unknown as Record<string, unknown>, [
    'visualStyle',
    'visualMaturity',
    'designComplexity',
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'backgroundColor',
    'headingFont',
    'bodyFont',
    'typographyPersonality',
    'whitespaceLevel',
    'contentDensity',
    'alignmentStyle',
    'cornerRadiusStyle',
    'shadowStyle',
    'preferredVisualMotif',
    'visualEmotion',
  ]) as VisualDnaFields;
  return Object.keys(fields).length ? fields : null;
}

function toCommunicationFields(row: CommunicationDna | null): CommunicationDnaFields | null {
  if (!row) return null;
  const fields = pickStringFields(row as unknown as Record<string, unknown>, [
    'tone',
    'voice',
    'brandPersonality',
    'emotionalIntensity',
    'headlineStyle',
    'ctaStyle',
    'urgencyLevel',
    'socialProofUsage',
    'primaryMessagingTheme',
    'secondaryMessagingTheme',
    'avoidedMessagingTheme',
    'readingLevel',
    'avgSentenceLength',
    'paragraphDensity',
    'activeVoicePercentage',
    'positioningStatement',
    'valuePropositionStyle',
    'differentiationStrategy',
    'introPattern',
    'storytellingPattern',
    'conclusionPattern',
  ]) as CommunicationDnaFields;
  return Object.keys(fields).length ? fields : null;
}

function toAudienceFields(row: AudienceDna | null): AudienceDnaFields | null {
  if (!row) return null;
  const fields: AudienceDnaFields = {
    ...pickStringFields(row as unknown as Record<string, unknown>, [
      'primaryPersona',
      'secondaryPersona',
      'industryFocus',
      'technicalLevel',
      'domainKnowledgeLevel',
    ]),
    audiencePainPoints: pickStringArray(row.audiencePainPoints),
    audienceMotivations: pickStringArray(row.audienceMotivations),
    audienceObjections: pickStringArray(row.audienceObjections),
  };
  const hasContent = Object.values(fields).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  );
  return hasContent ? fields : null;
}

function toComplianceFields(row: ComplianceDna | null): ComplianceDnaFields | null {
  if (!row) return null;
  return {
    bannedAbsoluteClaims: pickStringArray(row.bannedAbsoluteClaims),
    bannedComparativeClaims: pickStringArray(row.bannedComparativeClaims),
    allowedClaims: pickStringArray(row.allowedClaims),
    bannedWords: pickStringArray(row.bannedWords),
    allowedWords: pickStringArray(row.allowedWords),
    fearBasedMarketingAllowed: row.fearBasedMarketingAllowed,
    sensationalLanguageAllowed: row.sensationalLanguageAllowed,
    politicalContentAllowed: row.politicalContentAllowed,
    religiousContentAllowed: row.religiousContentAllowed,
    controversialTopicsAllowed: row.controversialTopicsAllowed,
  };
}

export type BrandDnaContext = {
  brandEntity: BrandEntity;
  primaryOffering: Offering | null;
  visualDna: VisualDna | null;
  communicationDna: CommunicationDna | null;
  audienceDna: AudienceDna | null;
  complianceDna: ComplianceDna | null;
};

export async function loadBrandDnaContext(companyId: string): Promise<BrandDnaContext | null> {
  const brandEntity = await prisma.brandEntity.findUnique({
    where: { companyId },
    include: {
      offerings: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        take: 1,
      },
      visualDna: true,
      communicationDna: true,
      audienceDna: true,
      complianceDna: true,
      company: { select: { website: true } },
    },
  });

  if (!brandEntity) return null;

  return {
    brandEntity,
    primaryOffering: brandEntity.offerings[0] ?? null,
    visualDna: brandEntity.visualDna,
    communicationDna: brandEntity.communicationDna,
    audienceDna: brandEntity.audienceDna,
    complianceDna: brandEntity.complianceDna,
  };
}

export function composeBrandTone(
  communicationDna: CommunicationDna | null,
  brandEntity: BrandEntity,
): string | null {
  const parts: string[] = [];
  if (communicationDna) {
    for (const v of [
      communicationDna.tone,
      communicationDna.voice,
      communicationDna.brandPersonality,
      communicationDna.emotionalIntensity,
      communicationDna.primaryMessagingTheme,
    ]) {
      if (v?.trim()) parts.push(v.trim());
    }
  }

  const branding = brandEntity.branding;
  const legacyTone = brandingField(branding, 'tone');
  if (legacyTone && !parts.some((p) => p.toLowerCase() === legacyTone.toLowerCase())) {
    parts.push(legacyTone);
  }
  const values = brandingField(branding, 'values');
  if (values) parts.push(values);

  if (!parts.length && brandEntity.topics.length) {
    parts.push(brandEntity.topics.slice(0, 3).join(', '));
  }

  return parts.length ? parts.join(' · ') : null;
}

function excerpt(text: string | null | undefined, max = 500): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function buildStructured(ctx: BrandDnaContext): BrandDnaStructured {
  const { brandEntity } = ctx;
  return {
    brand: {
      name: brandEntity.canonicalName,
      tagline: brandEntity.oneLiner?.trim() || undefined,
      industry: brandEntity.industry?.trim() || undefined,
      category: brandEntity.category?.trim() || undefined,
      targetAudiences: brandEntity.targetAudiences.filter(Boolean),
    },
    visual: toVisualFields(ctx.visualDna),
    communication: toCommunicationFields(ctx.communicationDna),
    audience: toAudienceFields(ctx.audienceDna),
    compliance: toComplianceFields(ctx.complianceDna),
  };
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' | ');
}

function formatVisualMarkdown(visual: VisualDnaFields): string[] {
  const lines: string[] = ['### Visual Identity'];
  const style = joinParts([
    visual.visualStyle ? `Style: ${visual.visualStyle}` : null,
    visual.visualMaturity ? `Maturity: ${visual.visualMaturity}` : null,
    visual.designComplexity ? `Complexity: ${visual.designComplexity}` : null,
  ]);
  if (style) lines.push(`- ${style}`);

  const colors = joinParts([
    visual.primaryColor ? `primary ${visual.primaryColor}` : null,
    visual.secondaryColor ? `secondary ${visual.secondaryColor}` : null,
    visual.accentColor ? `accent ${visual.accentColor}` : null,
    visual.backgroundColor ? `background ${visual.backgroundColor}` : null,
  ]);
  if (colors) lines.push(`- Colors: ${colors}`);

  const typo = joinParts([
    visual.headingFont ? `heading "${visual.headingFont}"` : null,
    visual.bodyFont ? `body "${visual.bodyFont}"` : null,
    visual.typographyPersonality ? `personality: ${visual.typographyPersonality}` : null,
  ]);
  if (typo) lines.push(`- Typography: ${typo}`);

  const layout = joinParts([
    visual.whitespaceLevel ? `whitespace ${visual.whitespaceLevel}` : null,
    visual.contentDensity ? `density ${visual.contentDensity}` : null,
    visual.alignmentStyle ? `alignment ${visual.alignmentStyle}` : null,
    visual.cornerRadiusStyle ? `corners ${visual.cornerRadiusStyle}` : null,
    visual.shadowStyle ? `shadows ${visual.shadowStyle}` : null,
  ]);
  if (layout) lines.push(`- Layout: ${layout}`);

  const motif = joinParts([
    visual.preferredVisualMotif ? `Motif: ${visual.preferredVisualMotif}` : null,
    visual.visualEmotion ? `Emotion: ${visual.visualEmotion}` : null,
  ]);
  if (motif) lines.push(`- ${motif}`);

  return lines.length > 1 ? lines : [];
}

function formatCommunicationMarkdown(comm: CommunicationDnaFields): string[] {
  const lines: string[] = ['### Communication Voice'];
  const voice = joinParts([
    comm.tone ? `Tone: ${comm.tone}` : null,
    comm.voice ? `Voice: ${comm.voice}` : null,
    comm.brandPersonality ? `Personality: ${comm.brandPersonality}` : null,
  ]);
  if (voice) lines.push(`- ${voice}`);

  const style = joinParts([
    comm.headlineStyle ? `Headline style: ${comm.headlineStyle}` : null,
    comm.ctaStyle ? `CTA: ${comm.ctaStyle}` : null,
    comm.urgencyLevel ? `Urgency: ${comm.urgencyLevel}` : null,
  ]);
  if (style) lines.push(`- ${style}`);

  if (comm.primaryMessagingTheme) {
    lines.push(`- Primary theme: ${comm.primaryMessagingTheme}`);
  }
  if (comm.avoidedMessagingTheme) {
    lines.push(`- Avoid: ${comm.avoidedMessagingTheme}`);
  }

  return lines.length > 1 ? lines : [];
}

function formatAudienceMarkdown(audience: AudienceDnaFields): string[] {
  const lines: string[] = ['### Audience'];
  const persona = joinParts([
    audience.primaryPersona ? `Persona: ${audience.primaryPersona}` : null,
    audience.industryFocus ? `Industry: ${audience.industryFocus}` : null,
  ]);
  if (persona) lines.push(`- ${persona}`);

  if (audience.audiencePainPoints?.length) {
    lines.push(`- Pain points: ${audience.audiencePainPoints.join(', ')}`);
  }
  if (audience.audienceMotivations?.length) {
    lines.push(`- Motivations: ${audience.audienceMotivations.join(', ')}`);
  }

  return lines.length > 1 ? lines : [];
}

function formatComplianceMarkdown(compliance: ComplianceDnaFields): string[] {
  const lines: string[] = ['### Compliance Guardrails'];
  if (compliance.bannedWords?.length) {
    lines.push(`- Do NOT use words: ${compliance.bannedWords.join(', ')}`);
  }
  const bannedClaims = [
    ...(compliance.bannedAbsoluteClaims ?? []),
    ...(compliance.bannedComparativeClaims ?? []),
  ];
  if (bannedClaims.length) {
    lines.push(`- Do NOT claim: ${bannedClaims.join(', ')}`);
  }
  if (!compliance.fearBasedMarketingAllowed) {
    lines.push('- Fear-based marketing: not allowed');
  }
  if (!compliance.sensationalLanguageAllowed) {
    lines.push('- Sensational language: not allowed');
  }

  return lines.length > 1 ? lines : [];
}

export function formatBrandDnaForLlm(ctx: BrandDnaContext): BrandDnaLlmPackage {
  const structured = buildStructured(ctx);
  const sections: string[] = ['## Brand DNA'];

  if (structured.visual) {
    sections.push(...formatVisualMarkdown(structured.visual));
  }
  if (structured.communication) {
    sections.push(...formatCommunicationMarkdown(structured.communication));
  }
  if (structured.audience) {
    sections.push(...formatAudienceMarkdown(structured.audience));
  }
  if (structured.compliance) {
    sections.push(...formatComplianceMarkdown(structured.compliance));
  }

  const markdown = sections.length > 1 ? sections.join('\n') : '';

  const summaryParts: string[] = [structured.brand.name];
  if (structured.communication?.tone) summaryParts.push(structured.communication.tone);
  if (structured.visual?.visualStyle) summaryParts.push(structured.visual.visualStyle);
  if (structured.audience?.primaryPersona) summaryParts.push(structured.audience.primaryPersona);
  let summary = summaryParts.join(' · ');
  if (summary.length > 200) summary = `${summary.slice(0, 197)}…`;

  return { structured, markdown, summary };
}

export function buildBrandDnaPromptBlock(ctx: BrandDnaContext): string {
  return formatBrandDnaForLlm(ctx).markdown;
}

export function hydrateImageGenFromBrandDna(
  ig: ImageGenState,
  ctx: BrandDnaContext,
): Partial<ImageGenState> {
  const llm = formatBrandDnaForLlm(ctx);
  const patch: Partial<ImageGenState> = {
    brandDnaApplied: true,
    brandDnaStructured: llm.structured,
    brandDnaPromptBlock: llm.markdown || undefined,
  };

  if (!ig.brandTone?.trim()) {
    const tone = composeBrandTone(ctx.communicationDna, ctx.brandEntity);
    if (tone) patch.brandTone = tone;
  }

  if (!ig.productDescription?.trim()) {
    const offering = ctx.primaryOffering;
    const fromOffering =
      offering?.description?.trim() || offering?.name?.trim() || null;
    const fromEntity =
      excerpt(ctx.brandEntity.oneLiner) ?? excerpt(ctx.brandEntity.about);
    const desc = fromOffering ?? fromEntity;
    if (desc) patch.productDescription = desc;
  }

  if (ig.copyCount == null || ig.copyCount < 1) {
    patch.copyCount = 4;
  }

  return patch;
}

export async function hydrateFromCompany(
  companyId: string,
  ig: ImageGenState,
): Promise<Partial<ImageGenState>> {
  if (ig.brandDnaApplied) return {};
  const ctx = await loadBrandDnaContext(companyId);
  if (!ctx) return {};
  return hydrateImageGenFromBrandDna(ig, ctx);
}

export async function ensureBrandDnaOnState(
  companyId: string,
  ig: ImageGenState,
): Promise<ImageGenState> {
  if (ig.brandDnaApplied) return ig;
  const patch = await hydrateFromCompany(companyId, ig);
  return { ...ig, ...patch };
}
