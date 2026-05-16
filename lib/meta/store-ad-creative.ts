import 'server-only';

import { GetObjectCommand } from '@aws-sdk/client-s3';

import { requireMetaAdAccountId, requireMetaFbPageId } from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';
import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';
import { createAdCreative, uploadAdImage, uploadAdVideo } from '@/lib/meta/client';
import { resolveMetaVideoThumbnailImageUrl } from '@/lib/meta/r2-thumbnail-url';

export type StoreAdCreativeInput = {
  companyId: string;
  assetId: string;
  headline: string;
  primaryText: string;
  description?: string | null;
  landingUrl: string;
  ctaType: string;
  pixelId?: string | null;
  metaCampaignId?: string | null;
};

export type StoredAdCreative = {
  id: string;
  metaCreativeId: string;
  assetId: string | null;
  headline: string;
  primaryText: string;
  description: string | null;
  ctaType: string;
  landingUrl: string;
  imageHash: string | null;
  videoId: string | null;
  thumbnailUrl: string | null;
};

async function readAssetBytes(input: { r2Bucket: string; r2Key: string }): Promise<Uint8Array> {
  const res = await r2.send(new GetObjectCommand({ Bucket: input.r2Bucket, Key: input.r2Key }));
  if (!res.Body) throw new Error('Missing R2 body');
  return new Uint8Array(await res.Body.transformToByteArray());
}

export async function storeAdCreativeForAsset(
  input: StoreAdCreativeInput,
): Promise<StoredAdCreative> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: input.companyId },
    select: { id: true, adAccountId: true, fbPageId: true },
  });
  if (!integration) {
    throw new Error('Meta not connected');
  }

  const adAccountId = requireMetaAdAccountId(integration.adAccountId);
  const fbPageId = requireMetaFbPageId(integration.fbPageId);

  const asset = await prisma.asset.findFirst({
    where: { id: input.assetId, companyId: input.companyId },
    select: {
      id: true,
      assetType: true,
      title: true,
      filename: true,
      r2Bucket: true,
      r2Key: true,
      thumbnailUrl: true,
    },
  });
  if (!asset) throw new Error('Asset not found');

  const r2PublicVideoUrl = getR2PublicObjectUrl(asset.r2Key);
  const metaVideoThumbnailUrl =
    asset.assetType === 'VIDEO'
      ? resolveMetaVideoThumbnailImageUrl({
          r2Key: asset.r2Key,
          thumbnailUrl: asset.thumbnailUrl,
        })
      : null;

  if (input.metaCampaignId) {
    const campaign = await prisma.metaCampaign.findFirst({
      where: { id: input.metaCampaignId, metaIntegrationId: integration.id },
      select: { id: true },
    });
    if (!campaign) throw new Error('Campaign not found');
  }

  const bytes = await readAssetBytes({ r2Bucket: asset.r2Bucket, r2Key: asset.r2Key });

  let imageHash: string | null = null;
  let videoId: string | null = null;

  if (asset.assetType === 'IMAGE') {
    const up = await uploadAdImage({
      companyId: input.companyId,
      adAccountId,
      bytes,
      filename: asset.filename,
    });
    imageHash = up.imageHash;
    await prisma.metaMedia.upsert({
      where: { assetId: asset.id },
      create: {
        metaIntegrationId: integration.id,
        kind: 'image',
        imageHash,
        uploadedAdAccountId: adAccountId,
        assetId: asset.id,
        imageUrl: asset.thumbnailUrl,
        r2Key: asset.r2Key,
        filename: asset.filename,
        bytes: bytes.byteLength,
        status: 'ready',
      },
      update: {
        imageHash,
        uploadedAdAccountId: adAccountId,
        imageUrl: asset.thumbnailUrl,
        r2Key: asset.r2Key,
        filename: asset.filename,
        bytes: bytes.byteLength,
        status: 'ready',
      },
    });
  } else if (asset.assetType === 'VIDEO') {
    if (!metaVideoThumbnailUrl) {
      throw new Error(
        'No public R2 thumbnail for this video. Set R2_PUBLIC_BASE_URL and ensure a JPEG exists at the same key with .jpg extension or under thumbnails/.',
      );
    }
    const up = await uploadAdVideo({
      companyId: input.companyId,
      adAccountId,
      bytes,
      filename: asset.filename,
      name: asset.title ?? asset.filename,
    });
    videoId = up.videoId;
    await prisma.metaMedia.upsert({
      where: { assetId: asset.id },
      create: {
        metaIntegrationId: integration.id,
        kind: 'video',
        videoId,
        assetId: asset.id,
        videoUrl: r2PublicVideoUrl,
        thumbnailUrl: metaVideoThumbnailUrl,
        r2Key: asset.r2Key,
        filename: asset.filename,
        bytes: bytes.byteLength,
        status: 'ready',
      },
      update: {
        videoId,
        uploadedAdAccountId: adAccountId,
        videoUrl: r2PublicVideoUrl,
        thumbnailUrl: metaVideoThumbnailUrl,
        r2Key: asset.r2Key,
        filename: asset.filename,
        bytes: bytes.byteLength,
        status: 'ready',
      },
    });
  } else {
    throw new Error(`Unsupported asset type: ${asset.assetType}`);
  }

  const pixelIds = input.pixelId?.trim() ? [input.pixelId.trim()] : [];

  const creative = await createAdCreative({
    companyId: input.companyId,
    adAccountId,
    fbPageId,
    headline: input.headline,
    primaryText: input.primaryText,
    description: input.description,
    ctaType: input.ctaType,
    landingUrl: input.landingUrl,
    imageHash,
    videoId,
    videoThumbnailUrl: metaVideoThumbnailUrl,
    pixelIds,
  });

  const row = await prisma.metaCreative.create({
    data: {
      metaIntegrationId: integration.id,
      metaCampaignId: input.metaCampaignId ?? null,
      assetId: asset.id,
      metaCreativeId: creative.id,
      imageHash,
      videoId,
      headline: input.headline,
      primaryText: input.primaryText,
      description: input.description ?? null,
      ctaType: input.ctaType,
      landingUrl: input.landingUrl,
      thumbnailUrl: metaVideoThumbnailUrl ?? asset.thumbnailUrl,
      aiGenerated: false,
      compliancePassed: false,
      approvedByUser: true,
      approvedAt: new Date(),
    },
    select: {
      id: true,
      metaCreativeId: true,
      assetId: true,
      headline: true,
      primaryText: true,
      description: true,
      ctaType: true,
      landingUrl: true,
      imageHash: true,
      videoId: true,
      thumbnailUrl: true,
    },
  });

  if (!row.metaCreativeId) {
    throw new Error('Meta creative id missing after create');
  }

  return {
    id: row.id,
    metaCreativeId: row.metaCreativeId,
    assetId: row.assetId,
    headline: row.headline,
    primaryText: row.primaryText,
    description: row.description,
    ctaType: row.ctaType,
    landingUrl: row.landingUrl,
    imageHash: row.imageHash,
    videoId: row.videoId,
    thumbnailUrl: row.thumbnailUrl,
  };
}
