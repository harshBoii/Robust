import 'server-only';

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { AssetType } from '@/app/generated/prisma/client';
import { r2 } from '@/lib/cloudfare/r2';
import { prisma } from '@/lib/prisma';

import { isAssetReadyForIntelligence } from './asset-ready';
import { formatBytes } from './format-size';
import type { AssetDownloadResponse, DownloadAssetBlock } from './types';

export type DownloadOptions = {
  expiresIn?: number;
  responseContentType?: string;
  responseContentDisposition?: string;
  filename?: string;
};

export class AssetDownloadError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409 = 404,
  ) {
    super(message);
    this.name = 'AssetDownloadError';
  }
}

function toAssetBlock(asset: {
  id: string;
  title: string;
  filename: string;
  originalSize: bigint;
  assetType: AssetType;
}): DownloadAssetBlock {
  const size = Number(asset.originalSize);
  return {
    id: asset.id,
    title: asset.title,
    filename: asset.filename,
    size,
    formattedSize: formatBytes(asset.originalSize),
    assetType: asset.assetType,
  };
}

export async function buildAssetDownloadResponse(
  assetId: string,
  opts: DownloadOptions = {},
  options?: { requireVideo?: boolean },
): Promise<AssetDownloadResponse> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      title: true,
      filename: true,
      originalSize: true,
      assetType: true,
      status: true,
      r2Key: true,
      r2Bucket: true,
    },
  });

  if (!asset) {
    throw new AssetDownloadError('Asset not found', 404);
  }

  if (options?.requireVideo && asset.assetType !== 'VIDEO') {
    throw new AssetDownloadError('Asset is not a video', 404);
  }

  if (!options?.requireVideo && asset.assetType === 'VIDEO') {
    throw new AssetDownloadError('Use the video download route for VIDEO assets', 404);
  }

  if (!asset.r2Key?.trim()) {
    throw new AssetDownloadError('Asset file not available', 409);
  }

  if (asset.status === 'UPLOADING') {
    throw new AssetDownloadError('Asset still uploading', 409);
  }
  if (!isAssetReadyForIntelligence(asset)) {
    throw new AssetDownloadError('Asset still processing', 409);
  }

  const expiresIn = Math.min(
    Math.max(opts.expiresIn ?? 3600, 60),
    86400,
  );
  const downloadFilename = opts.filename?.trim() || asset.filename;

  const commandInput: ConstructorParameters<typeof GetObjectCommand>[0] = {
    Bucket: asset.r2Bucket,
    Key: asset.r2Key,
  };

  if (opts.responseContentType?.trim()) {
    commandInput.ResponseContentType = opts.responseContentType.trim();
  }
  if (opts.responseContentDisposition?.trim()) {
    commandInput.ResponseContentDisposition = opts.responseContentDisposition.trim();
  } else if (downloadFilename) {
    commandInput.ResponseContentDisposition = `attachment; filename="${downloadFilename.replace(/"/g, '')}"`;
  }

  const command = new GetObjectCommand(commandInput);
  const url = await getSignedUrl(r2, command, { expiresIn });

  const block = toAssetBlock(asset);
  const response: AssetDownloadResponse = {
    success: true,
    asset: block,
    download: {
      url,
      expiresIn,
      filename: downloadFilename,
    },
  };

  if (asset.assetType === 'VIDEO') {
    response.video = block;
  }

  return response;
}
