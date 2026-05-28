import { prisma } from "@/lib/prisma";

export async function approveBountyToShopify({ companyId, bountyId }: { companyId: string; bountyId: string }) {
  const bounty = await prisma.citationBounty.findFirst({
    where: { id: bountyId, companyId },
    select: { id: true, aeoPageId: true },
  });
  if (!bounty || !bounty.aeoPageId) {
    throw new Error("Bounty or generated page not found");
  }
  await prisma.citationBounty.update({
    where: { id: bountyId },
    data: { publishedAt: new Date() },
  });
  return { bountyId: bounty.id, aeoPageId: bounty.aeoPageId };
}
