import { z } from 'zod';

import type { OfferingType } from '@/app/generated/prisma/client';

export type DataMineOfferingDto = {
  id: string;
  companyId: string;
  brandEntityId: string;
  name: string;
  slug: string;
  description: string | null;
  offeringType: OfferingType;
  url: string | null;
  keywords: string[];
  useCases: string[];
  targetAudiences: string[];
  differentiators: string[];
  competitors: string[];
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DataMineBrandEntityDto = {
  id: string;
  companyId: string;
  canonicalName: string;
  aliases: string[];
  entityType: string | null;
  oneLiner: string | null;
  about: string | null;
  industry: string | null;
  category: string | null;
  headquartersCity: string | null;
  headquartersCountry: string | null;
  foundedYear: number | null;
  employeeRange: string | null;
  businessModel: string | null;
  topics: string[];
  keywords: string[];
  targetAudiences: string[];
  branding: unknown | null;
  createdAt: string;
  updatedAt: string;
};

export type DataMineSnapshot = {
  website: string | null;
  linkedinUrl: string | null;
  brandEntity: DataMineBrandEntityDto | null;
  offerings: DataMineOfferingDto[];
};

const seedCompanySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const seedBrandEntitySchema = z.object({
  id: z.string().optional(),
  companyId: z.string().optional(),
  canonicalName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  entityType: z.string().nullable().optional(),
  oneLiner: z.string().nullable().optional(),
  about: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  headquartersCity: z.string().nullable().optional(),
  headquartersCountry: z.string().nullable().optional(),
  foundedYear: z.number().nullable().optional(),
  employeeRange: z.string().nullable().optional(),
  businessModel: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  targetAudiences: z.array(z.string()).optional(),
  authorityScore: z.unknown().optional(),
  citationCount: z.unknown().optional(),
  lastCrawledAt: z.unknown().optional(),
  completenessScore: z.unknown().optional(),
  lastEnrichedAt: z.unknown().optional(),
  enrichmentSource: z.unknown().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const seedOfferingSchema = z.object({
  id: z.string().optional(),
  entityId: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  offeringType: z.string().optional(),
  url: z.string().nullable().optional(),
  keywords: z.array(z.string()).optional(),
  useCases: z.array(z.string()).optional(),
  targetAudiences: z.array(z.string()).optional(),
  differentiators: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const microserviceSeedResponseSchema = z.object({
  company: seedCompanySchema.optional(),
  brandEntity: seedBrandEntitySchema.optional(),
  offerings: z.array(seedOfferingSchema).optional(),
  branding: z.unknown().nullable().optional(),
});

export type MicroserviceSeedResponse = z.infer<typeof microserviceSeedResponseSchema>;

export type MappedCompanyFromSeed = {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  email?: string | null;
};

export type MappedBrandEntityFromSeed = {
  canonicalName: string;
  aliases: string[];
  entityType: string | null;
  oneLiner: string | null;
  about: string | null;
  industry: string | null;
  category: string | null;
  headquartersCity: string | null;
  headquartersCountry: string | null;
  foundedYear: number | null;
  employeeRange: string | null;
  businessModel: string | null;
  topics: string[];
  keywords: string[];
  targetAudiences: string[];
  branding: unknown | null;
};

export type MappedOfferingFromSeed = {
  name: string;
  slug: string;
  description: string | null;
  offeringType: OfferingType;
  url: string | null;
  keywords: string[];
  useCases: string[];
  targetAudiences: string[];
  differentiators: string[];
  competitors: string[];
  isPrimary: boolean;
  isActive: boolean;
};

export type MappedSeedPayload = {
  company: MappedCompanyFromSeed;
  brandEntity: MappedBrandEntityFromSeed | null;
  offerings: MappedOfferingFromSeed[];
};
