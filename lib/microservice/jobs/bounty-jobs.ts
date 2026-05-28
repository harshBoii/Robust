import { prisma } from "@/lib/prisma";
import { syncBountyRevenueForCompany } from "@/lib/geo/radar/bountySync";

export async function runBountyJob(companyId: string) {
  const count = await syncBountyRevenueForCompany(prisma, companyId);
  return { synced: count };
}
