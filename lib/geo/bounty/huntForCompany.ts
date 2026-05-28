import { prisma } from "@/lib/prisma";

export async function huntBountyForCompany({ companyId, bountyId }: { companyId: string; bountyId: string }) {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: { id: true, query: true, pageType: true },
  });
  if (!bounty) throw new Error("Bounty not found");

  const aeoPage = await prisma.aeoPage.create({
    data: {
      companyId,
      slug: `bounty-${bountyId.slice(0, 12)}`,
      title: bounty.query,
      pageType: bounty.pageType,
      description: `Generated content for: ${bounty.query}`,
      status: "DRAFT",
    },
    select: { id: true },
  });

  await prisma.citationBounty.update({
    where: { id: bountyId },
    data: { aeoPageId: aeoPage.id, status: "HUNTED", huntedAt: new Date() },
  });

  return { aeoPageId: aeoPage.id };
}
