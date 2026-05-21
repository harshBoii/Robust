import 'server-only';

import { fetchImageBytesFromUrl } from '@/lib/cloudfare/r2-video-thumbnail';
import { storeGeneratedImage } from './store-generated';

/** Download external product image (e.g. Shopify CDN) and persist as Asset on R2. */
export async function importProductImageFromUrl(input: {
  companyId: string;
  sessionId: string;
  imageUrl: string;
  title: string;
}): Promise<{ assetId: string; imageUrl: string }> {
  const bytes = await fetchImageBytesFromUrl(input.imageUrl, { attempts: 4, delayMs: 1500 });
  if (!bytes) throw new Error('Could not download product image');

  const stored = await storeGeneratedImage({
    companyId: input.companyId,
    sessionId: input.sessionId,
    imageBase64: Buffer.from(bytes).toString('base64'),
    title: input.title,
    label: 'Product reference',
  });

  return { assetId: stored.assetId, imageUrl: stored.imageUrl };
}
