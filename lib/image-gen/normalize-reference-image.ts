import 'server-only';

import sharp from 'sharp';

/** OpenAI image edit expects PNG/JPEG/WebP; normalize AVIF and other formats to PNG. */
export async function normalizeReferenceImageForOpenAI(
  bytes: Uint8Array | Buffer,
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  try {
    const png = await sharp(buf).rotate().png().toBuffer();
    return { buffer: png, filename: 'reference.png', mimeType: 'image/png' };
  } catch {
    return { buffer: buf, filename: 'reference.png', mimeType: 'image/png' };
  }
}
