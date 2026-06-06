import 'server-only';

import { GetObjectCommand } from '@aws-sdk/client-s3';

import { r2 } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';
import { uploadImageAsset, uploadYoutubeAsset } from '@/lib/google-ads/client';
import { googleAdsErrorFromRaw } from '@/lib/google-ads/errors';

async function readAssetBytes(input: { r2Bucket: string; r2Key: string }): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({ Bucket: input.r2Bucket, Key: input.r2Key }));
  if (!res.Body) throw new Error('Missing R2 body');
  return new Uint8Array(await res.Body.transformToByteArray());
}

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
    select: { id: true, title: true, r2Key: true, r2Bucket: true, mimeType: true, assetType: true },
  });
  if (!asset) throw new Error(`Asset not found: ${input.assetId}`);
  if (!asset.r2Key?.trim()) throw new Error('Asset has no downloadable file');

  try {
    const bytes = await readAssetBytes({ r2Bucket: asset.r2Bucket, r2Key: asset.r2Key });
    const base64 = Buffer.from(bytes).toString('base64');

    const assetType = input.assetType ?? 'IMAGE';
    const mimeType = asset.mimeType?.toLowerCase().includes('png') ? 'IMAGE_PNG' : 'IMAGE_JPEG';

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
