import 'server-only';

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';
import type { UploadSource } from '@/app/generated/prisma/enums';
import { prisma } from '@/lib/prisma';

export type StoreGeneratedInput = {
  companyId: string;
  sessionId: string;
  imageBase64: string;
  title?: string;
  label?: string;
};

export type StoreGeneratedResult = {
  assetId: string;
  imageUrl: string;
  r2Key: string;
};

export async function storeGeneratedImage(
  input: StoreGeneratedInput,
): Promise<StoreGeneratedResult> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME is not configured');

  const r2Key = `generated/${input.companyId}/${input.sessionId}/${randomUUID()}.png`;
  const bytes = Buffer.from(input.imageBase64, 'base64');

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: bytes,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const publicUrl = getR2PublicObjectUrl(r2Key);
  if (!publicUrl) throw new Error('R2_PUBLIC_BASE_URL is not configured');

  const asset = await prisma.asset.create({
    data: {
      companyId: input.companyId,
      assetType: 'IMAGE',
      title: input.title ?? input.label ?? 'Generated image',
      filename: r2Key.split('/').pop() ?? 'generated.png',
      originalSize: BigInt(bytes.length),
      status: 'READY',
      r2Key,
      r2Bucket: bucket,
      mimeType: 'image/png',
      thumbnailUrl: publicUrl,
      uploadSource: 'GENERATED' as UploadSource,
      metadata: {
        generatedInChat: true,
        chatSessionId: input.sessionId,
        label: input.label ?? null,
      },
    },
  });

  return { assetId: asset.id, imageUrl: publicUrl, r2Key };
}
