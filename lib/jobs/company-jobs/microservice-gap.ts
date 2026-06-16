import 'server-only';

import { prisma } from '@/lib/prisma';

import { MICROSERVICE_GAP_MS } from './defaults';
import { MicroserviceGapError } from './types';

export function remainingMicroserviceGapMs(lastAt: Date | null | undefined): number {
  if (!lastAt) return 0;
  const elapsed = Date.now() - lastAt.getTime();
  return Math.max(0, MICROSERVICE_GAP_MS - elapsed);
}

export async function assertMicroserviceGap(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { lastMicroserviceJobAt: true },
  });
  const remaining = remainingMicroserviceGapMs(company?.lastMicroserviceJobAt);
  if (remaining > 0) {
    throw new MicroserviceGapError(Math.ceil(remaining / 1000));
  }
}

export async function recordMicroserviceRun(companyId: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { lastMicroserviceJobAt: new Date() },
  });
}

export async function sleepMicroserviceGap(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, MICROSERVICE_GAP_MS));
}
