import { getZernioClient, isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';

function zernioApiBaseUrl(): string {
  return (process.env.ZERNIO_API_BASE_URL?.trim() || 'https://zernio.com/api').replace(/\/$/, '');
}

/**
 * Disconnect a connected social account via Zernio's social-accounts API.
 * @see https://zernio.com/api/v1/social-accounts/{socialAccountId}
 */
export async function disconnectZernioSocialAccount(socialAccountId: string): Promise<void> {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Zernio is not configured (ZERNIO_API_KEY missing)');
  }

  const id = socialAccountId.trim();
  if (!id) {
    throw new Error('Missing social account id');
  }

  const res = await fetch(`${zernioApiBaseUrl()}/v1/social-accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (res.ok || res.status === 404) {
    return;
  }

  const body = await res.text().catch(() => '');
  throw new Error(body || `Zernio disconnect failed (${res.status})`);
}

/** Legacy fallback when the stored id predates social-accounts (e.g. acc_* from listAccounts). */
export async function disconnectZernioSocialAccountLegacy(accountId: string): Promise<void> {
  if (!isZernioConfigured()) return;
  const zernio = getZernioClient();
  const { error } = await zernio.accounts.deleteAccount({
    path: { accountId },
  });
  if (error) {
    throw new Error(zernioApiErrorMessage(error) || 'Zernio disconnect failed');
  }
}

export async function disconnectZernioSocialAccountWithFallback(accountId: string): Promise<void> {
  try {
    await disconnectZernioSocialAccount(accountId);
  } catch (socialErr) {
    if (accountId.startsWith('acc_')) {
      await disconnectZernioSocialAccountLegacy(accountId);
      return;
    }
    throw socialErr;
  }
}
