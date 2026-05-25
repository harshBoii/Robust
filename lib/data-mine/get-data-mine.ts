import 'server-only';

import type {
  DataMineBrandEntityDto,
  DataMineOfferingDto,
  DataMineSnapshot,
} from '@/lib/data-mine/types';
import { prisma } from '@/lib/prisma';

function serializeBrandEntity(row: {
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
  branding: unknown;
  createdAt: Date;
  updatedAt: Date;
}): DataMineBrandEntityDto {
  return {
    id: row.id,
    companyId: row.companyId,
    canonicalName: row.canonicalName,
    aliases: row.aliases,
    entityType: row.entityType,
    oneLiner: row.oneLiner,
    about: row.about,
    industry: row.industry,
    category: row.category,
    headquartersCity: row.headquartersCity,
    headquartersCountry: row.headquartersCountry,
    foundedYear: row.foundedYear,
    employeeRange: row.employeeRange,
    businessModel: row.businessModel,
    topics: row.topics,
    keywords: row.keywords,
    targetAudiences: row.targetAudiences,
    branding: row.branding,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeOffering(row: {
  id: string;
  companyId: string;
  brandEntityId: string;
  name: string;
  slug: string;
  description: string | null;
  offeringType: DataMineOfferingDto['offeringType'];
  url: string | null;
  keywords: string[];
  useCases: string[];
  targetAudiences: string[];
  differentiators: string[];
  competitors: string[];
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DataMineOfferingDto {
  return {
    id: row.id,
    companyId: row.companyId,
    brandEntityId: row.brandEntityId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    offeringType: row.offeringType,
    url: row.url,
    keywords: row.keywords,
    useCases: row.useCases,
    targetAudiences: row.targetAudiences,
    differentiators: row.differentiators,
    competitors: row.competitors,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getDataMineSnapshot(companyId: string): Promise<DataMineSnapshot | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      website: true,
      linkedinUrl: true,
      brandEntity: {
        include: {
          offerings: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        },
      },
    },
  });

  if (!company) return null;

  const brandEntity = company.brandEntity
    ? serializeBrandEntity(company.brandEntity)
    : null;
  const offerings = company.brandEntity?.offerings.map(serializeOffering) ?? [];

  return {
    website: company.website,
    linkedinUrl: company.linkedinUrl,
    brandEntity,
    offerings,
  };
}
