'use client';

export type LogoAssetOption = {
  id: string;
  title: string;
  filename: string;
  thumbnailUrl: string | null;
  createdAt: string;
};

async function profileJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export async function fetchLogoAssets(): Promise<LogoAssetOption[]> {
  const data = await profileJson<{ assets: LogoAssetOption[] }>(
    await fetch('/api/profile/logo/assets', { cache: 'no-store' }),
  );
  return data.assets;
}

export async function fetchAssetDisplayUrl(assetId: string): Promise<string> {
  const data = await profileJson<{ url: string }>(
    await fetch(`/api/assets/${assetId}/url`, { cache: 'no-store' }),
  );
  return data.url;
}
