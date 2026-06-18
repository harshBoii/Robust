import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildBrandProfile } from '@/lib/brand-dna/build-brand-profile';
import { generateAudienceDna } from '@/lib/brand-dna/audience/generate';
import { generateCommunicationDna } from '@/lib/brand-dna/communication/generate';
import { analyzeVisualScreenshot } from '@/lib/brand-dna/visual/analyze-visual-screenshot';
import { mergeVisualDna } from '@/lib/brand-dna/visual/merge-visual-dna';
import { scrapeLandingPage } from '@/lib/brand-dna/visual/scrape-landing-page';
import { getBrandEntityIdForCompany } from '@/lib/brand-dna/require-brand';

export type DnaGenerationResult = {
  communication: boolean;
  audience: boolean;
  visual: boolean;
  errors: string[];
};

export async function generateAllBrandDna(companyId: string): Promise<DnaGenerationResult> {
  const brandId = await getBrandEntityIdForCompany(companyId);
  const result: DnaGenerationResult = {
    communication: false,
    audience: false,
    visual: false,
    errors: [],
  };

  if (!brandId) {
    result.errors.push('Brand entity not found');
    return result;
  }

  const brand = await prisma.brandEntity.findFirst({
    where: { id: brandId, companyId },
    include: {
      company: { select: { website: true } },
      offerings: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        take: 5,
      },
    },
  });

  if (!brand) {
    result.errors.push('Brand entity not found');
    return result;
  }

  const primaryOffering = brand.offerings.find((o) => o.isPrimary) ?? brand.offerings[0] ?? null;
  const profile = buildBrandProfile({
    brandEntity: brand,
    company: brand.company,
    primaryOffering,
  });

  try {
    const communicationDna = await generateCommunicationDna(profile);
    await prisma.communicationDna.upsert({
      where: { brandEntityId: brandId },
      create: { brandEntityId: brandId, ...communicationDna },
      update: communicationDna,
    });
    result.communication = true;
  } catch (e) {
    result.errors.push(
      e instanceof Error ? e.message : 'Communication DNA failed',
    );
  }

  try {
    const audienceDna = await generateAudienceDna(profile);
    await prisma.audienceDna.upsert({
      where: { brandEntityId: brandId },
      create: { brandEntityId: brandId, ...audienceDna },
      update: audienceDna,
    });
    result.audience = true;
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'Audience DNA failed');
  }

  const landingUrl = brand.company.website?.trim();
  if (landingUrl) {
    try {
      const scraped = await scrapeLandingPage({
        landingPageUrl: landingUrl,
        companyId,
        brandId,
      });
      const vision = await analyzeVisualScreenshot(scraped.screenshotBase64);
      const visualDna = mergeVisualDna(scraped.domPalette, vision);
      await prisma.visualDna.upsert({
        where: { brandEntityId: brandId },
        create: { brandEntityId: brandId, ...visualDna },
        update: visualDna,
      });
      result.visual = true;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : 'Visual DNA failed');
    }
  } else {
    result.errors.push('No website URL for visual DNA');
  }

  return result;
}
