import 'server-only';

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

import type { AssetType } from '@/app/generated/prisma/client';
import { UploadSource } from '@/app/generated/prisma/enums';
import { enqueueAssetStreamUpload } from '@/lib/cloudfare/stream';
import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';
import {
  getMetaAdImageDownloadUrl,
  getMetaVideoSourceUrl,
  type MetaAdCreativeDetails,
} from '@/lib/meta/client';
import {
  logMetaCreativeDownload,
  logMetaCreativeProgress,
} from '@/lib/meta/creative-log';
import { resolveMetaGraphAccessToken } from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';

const MAX_BYTES = 250 * 1024 * 1024;

function extensionFromMime(mimeType: string, fallback: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('quicktime')) return 'mov';
  return fallback;
}

async function downloadMediaBytes(
  url: string,
  accessToken: string,
  metaAdId: string,
  kind: 'image' | 'video',
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const started = Date.now();
  const parsed = new URL(url);
  const urlHost = parsed.hostname;
  if (
    !parsed.searchParams.has('access_token') &&
    (parsed.hostname.includes('facebook.com') ||
      parsed.hostname.includes('fbcdn.net') ||
      parsed.hostname.includes('fbsbx.com'))
  ) {
    parsed.searchParams.set('access_token', accessToken);
  }

  const res = await fetch(parsed.toString(), {
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to download Meta media (${res.status})`);
  }

  const mimeType =
    res.headers.get('content-type')?.split(';')[0]?.trim() ||
    'application/octet-stream';
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new Error('Meta creative exceeds maximum import size (250MB)');
  }
  if (buf.byteLength === 0) {
    throw new Error('Downloaded Meta creative is empty');
  }

  logMetaCreativeDownload({
    metaAdId,
    kind,
    status: res.status,
    bytes: buf.byteLength,
    mimeType,
    durationMs: Date.now() - started,
    urlHost,
  });

  return { bytes: buf, mimeType };
}

export type ImportMetaCreativeInput = {
  companyId: string;
  adAccountId: string;
  metaDetails: MetaAdCreativeDetails;
  adTitle: string | null;
};

export type ImportMetaCreativeResult = {
  assetId: string;
  assetType: AssetType;
};

export async function importMetaCreativeToGallery(
  input: ImportMetaCreativeInput,
): Promise<ImportMetaCreativeResult> {
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!bucket) throw new Error('R2_BUCKET_NAME is not configured');

  const token = await resolveMetaGraphAccessToken(input.companyId);
  const { metaDetails } = input;

  logMetaCreativeProgress('import', 'start', {
    metaAdId: metaDetails.metaAdId,
    imageHash: metaDetails.imageHash,
    videoId: metaDetails.videoId,
    imageUrl: Boolean(metaDetails.imageUrl),
    thumbnailUrl: Boolean(metaDetails.thumbnailUrl),
    isCatalogCreative: metaDetails.isCatalogCreative,
  });

  let downloadUrl: string;
  let assetType: AssetType;
  let importSource: 'video_id' | 'image_hash' | 'image_url' | 'thumbnail';

  if (metaDetails.videoId) {
    assetType = 'VIDEO';
    importSource = 'video_id';
    logMetaCreativeProgress('import', 'resolve video source URL', {
      videoId: metaDetails.videoId,
    });
    downloadUrl = await getMetaVideoSourceUrl({
      companyId: input.companyId,
      videoId: metaDetails.videoId,
    });
  } else if (metaDetails.imageHash) {
    assetType = 'IMAGE';
    importSource = 'image_hash';
    logMetaCreativeProgress('import', 'resolve image download URL', {
      imageHash: metaDetails.imageHash,
    });
    downloadUrl = await getMetaAdImageDownloadUrl({
      companyId: input.companyId,
      adAccountId: input.adAccountId,
      imageHash: metaDetails.imageHash,
    });
  } else if (metaDetails.imageUrl) {
    assetType = 'IMAGE';
    importSource = 'image_url';
    downloadUrl = metaDetails.imageUrl;
    logMetaCreativeProgress('import', 'use creative image_url', { importSource });
  } else if (metaDetails.thumbnailUrl) {
    assetType = 'IMAGE';
    importSource = 'thumbnail';
    downloadUrl = metaDetails.thumbnailUrl;
    logMetaCreativeProgress('import', 'use creative thumbnail_url (catalog/dynamic)', {
      importSource,
      isCatalogCreative: metaDetails.isCatalogCreative,
    });
  } else {
    throw new Error('No downloadable media URL on Meta creative');
  }

  logMetaCreativeProgress('import', 'download bytes', { assetType });
  const { bytes, mimeType } = await downloadMediaBytes(
    downloadUrl,
    token,
    metaDetails.metaAdId,
    assetType === 'VIDEO' ? 'video' : 'image',
  );
  const ext = extensionFromMime(
    mimeType,
    assetType === 'VIDEO' ? 'mp4' : 'jpg',
  );
  const r2Key = `uploads/${input.companyId}/meta-import/${Date.now()}-${randomUUID()}.${ext}`;
  const filename = `meta-${metaDetails.metaAdId.slice(-8)}.${ext}`;
  const title =
    metaDetails.headline ??
    metaDetails.adName ??
    input.adTitle ??
    'Imported Meta ad';

  logMetaCreativeProgress('import', 'upload to R2', { r2Key, bytes: bytes.byteLength });
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: bytes,
      ContentType: mimeType,
    }),
  );

  const publicPreview =
    assetType === 'IMAGE' ? getR2PublicObjectUrl(r2Key) : null;

  const asset = await prisma.asset.create({
    data: {
      companyId: input.companyId,
      assetType,
      title: title.slice(0, 500),
      filename: filename.slice(0, 500),
      originalSize: BigInt(bytes.byteLength),
      status: assetType === 'VIDEO' ? 'PROCESSING' : 'READY',
      r2Key,
      r2Bucket: bucket,
      mimeType: mimeType.slice(0, 100),
      thumbnailUrl: publicPreview ?? metaDetails.thumbnailUrl,
      uploadSource: UploadSource.URL,
      metadata: {
        importedFromMeta: true,
        importSource,
        metaAdId: metaDetails.metaAdId,
        imageHash: metaDetails.imageHash,
        videoId: metaDetails.videoId,
        isCatalogCreative: metaDetails.isCatalogCreative,
      },
    },
    select: { id: true, assetType: true },
  });

  if (assetType === 'VIDEO') {
    logMetaCreativeProgress('import', 'enqueue Stream', { assetId: asset.id });
    await enqueueAssetStreamUpload(asset.id, 'HIGH');
  }

  logMetaCreativeProgress('import', 'done', {
    metaAdId: metaDetails.metaAdId,
    assetId: asset.id,
    assetType,
  });

  return { assetId: asset.id, assetType: asset.assetType };
}
