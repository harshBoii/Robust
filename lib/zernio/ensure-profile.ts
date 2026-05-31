import { prisma } from '@/lib/prisma';
import { getZernioClient, zernioApiErrorMessage } from '@/lib/zernio/client';

export async function ensureZernioProfile(companyId: string): Promise<string> {
  const existing = await prisma.zernioProfile.findUnique({
    where: { companyId },
    select: { zernioProfileId: true },
  });

  if (existing?.zernioProfileId) {
    return existing.zernioProfileId;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  const zernio = getZernioClient();
  const { data, error } = await zernio.profiles.createProfile({
    body: {
      name: company.name,
      description: 'Robust workspace',
    },
  });

  if (error || !data?.profile?._id) {
    throw new Error(zernioApiErrorMessage(error) || 'Failed to create Zernio profile');
  }

  await prisma.zernioProfile.create({
    data: {
      companyId,
      zernioProfileId: data.profile._id,
    },
  });

  return data.profile._id;
}
