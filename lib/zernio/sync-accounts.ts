import type { SocialProvider } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getZernioClient, zernioApiErrorMessage } from '@/lib/zernio/client';
import { ensureZernioProfile } from '@/lib/zernio/ensure-profile';
import { fromZernioPlatform, ZERNIO_SOCIAL_PROVIDERS } from '@/lib/zernio/platforms';

type ZernioListedAccount = {
  _id: string;
  platform: string;
  profileId?: string | { _id?: string };
  username?: string;
  displayName?: string;
};

function profileIdFromAccount(account: ZernioListedAccount): string | null {
  const profileId = account.profileId;
  if (!profileId) return null;
  if (typeof profileId === 'string') return profileId;
  return profileId._id ?? null;
}

export async function syncZernioAccounts(companyId: string): Promise<void> {
  const zernioProfileId = await ensureZernioProfile(companyId);
  const zernio = getZernioClient();

  const { data, error } = await zernio.accounts.listAccounts();
  if (error) {
    throw new Error(zernioApiErrorMessage(error) || 'Failed to list Zernio accounts');
  }

  const accounts = ((data?.accounts ?? []) as ZernioListedAccount[]).filter(
    (account: ZernioListedAccount) => profileIdFromAccount(account) === zernioProfileId,
  );

  const byProvider = new Map<SocialProvider, ZernioListedAccount>();
  for (const account of accounts) {
    const provider = fromZernioPlatform(account.platform);
    if (!provider) continue;
    if (!byProvider.has(provider)) {
      byProvider.set(provider, account);
    }
  }

  for (const provider of ZERNIO_SOCIAL_PROVIDERS) {
    const account = byProvider.get(provider);
    if (account?._id) {
      await prisma.socialIntegration.upsert({
        where: {
          companyId_provider: { companyId, provider },
        },
        create: {
          companyId,
          provider,
          zernioAccountId: account._id,
          accountHandle: account.username ?? account.displayName ?? null,
        },
        update: {
          zernioAccountId: account._id,
          accountHandle: account.username ?? account.displayName ?? null,
        },
      });
    } else {
      await prisma.socialIntegration.deleteMany({
        where: { companyId, provider },
      });
    }
  }
}
