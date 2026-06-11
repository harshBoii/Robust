import 'server-only';

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';

export async function uploadBrandDnaBuffer(input: {
  companyId: string;
  brandId: string;
  subpath: 'screenshots' | 'compliance';
  filename: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ r2Key: string; publicUrl: string }> {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME is not configured');

  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `brand-dna/${input.companyId}/${input.brandId}/${input.subpath}/${randomUUID()}-${safeName}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: input.bytes,
      ContentType: input.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const publicUrl = getR2PublicObjectUrl(r2Key);
  if (!publicUrl) throw new Error('R2_PUBLIC_BASE_URL is not configured');

  return { r2Key, publicUrl };
}
