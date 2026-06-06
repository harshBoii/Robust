import 'server-only';

import { prisma } from '@/lib/prisma';
import { uploadImageAsset, uploadYoutubeAsset } from '@/lib/google-ads/client';
import { googleAdsErrorFromRaw } from '@/lib/google-ads/errors';

/**
 * Download a gallery asset from R2, upload it to Google Ads as an image asset,
 * and store the resulting GoogleMedia row.
 */
export async function uploadGalleryAssetToGoogle(input: {
  googleAdsIntegrationId: string;
  assetId: string;
  assetType?: 'IMAGE' | 'SQUARE_IMAGE' | 'LOGO' | 'LANDSCAPE_LOGO';
}): Promise<{ googleAssetResourceName: string }> {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: input.googleAdsIntegrationId },
    select: { customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) throw new Error('Google Ads integration not configured');

  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    select: { id: true, title: true, sourceUrl: true, assetType: true },
  });
  if (!asset) throw new Error(`Asset not found: ${input.assetId}`);

  if (!asset.sourceUrl) throw new Error('Asset has no downloadable URL');

  try {
    // Fetch bytes
    const response = await fetch(asset.sourceUrl);
    if (!response.ok) throw new Error(`Failed to fetch asset: ${response.status}`);
    const bytes = await response.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const assetType = input.assetType ?? 'IMAGE';
    const mimeType = asset.sourceUrl.toLowerCase().includes('.png') ? 'IMAGE_PNG' : 'IMAGE_JPEG';

    const { resourceName } = await uploadImageAsset({
      refreshToken: integration.refreshToken,
      customerId: integration.customerId,
      loginCustomerId: integration.loginCustomerId,
      asset: {
        name: `${asset.title ?? asset.id}`,
        dataBase64: base64,
        mimeType,
      },
    });

    // Persist GoogleMedia record
    await prisma.googleMedia.create({
      data: {
        googleAdsIntegrationId: input.googleAdsIntegrationId,
        assetId: input.assetId,
        googleAssetResourceName: resourceName,
        assetType,
        uploadedCustomerId: integration.customerId,
      },
    });

    return { googleAssetResourceName: resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

/**
 * For a YouTube streaming asset, create a YouTube video asset in Google Ads.
 */
export async function uploadYoutubeVideoToGoogle(input: {
  googleAdsIntegrationId: string;
  assetId: string;
  youtubeVideoId: string;
  videoTitle?: string;
}): Promise<{ googleAssetResourceName: string }> {
  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { id: input.googleAdsIntegrationId },
    select: { customerId: true, loginCustomerId: true, refreshToken: true },
  });
  if (!integration?.customerId) throw new Error('Google Ads integration not configured');

  try {
    const { resourceName } = await uploadYoutubeAsset({
      refreshToken: integration.refreshToken,
      customerId: integration.customerId,
      loginCustomerId: integration.loginCustomerId,
      asset: {
        youtubeVideoId: input.youtubeVideoId,
        name: input.videoTitle ?? input.youtubeVideoId,
      },
    });

    await prisma.googleMedia.create({
      data: {
        googleAdsIntegrationId: input.googleAdsIntegrationId,
        assetId: input.assetId,
        googleAssetResourceName: resourceName,
        assetType: 'YOUTUBE_VIDEO',
        uploadedCustomerId: integration.customerId,
      },
    });

    return { googleAssetResourceName: resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}
