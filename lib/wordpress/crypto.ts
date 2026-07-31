import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

/**
 * WordPress application passwords are long-lived credentials for a third-party site.
 * They get their own key rather than riding on JWT_SECRET, so rotating the session
 * secret does not silently break every connected WordPress site.
 */
function getKey(): Buffer {
  const raw = process.env.WORDPRESS_CREDENTIALS_SECRET?.trim();
  if (!raw) {
    throw new Error('WORDPRESS_CREDENTIALS_SECRET is not configured');
  }
  return createHash('sha256').update(raw).digest();
}

export function isWordPressCryptoConfigured(): boolean {
  return Boolean(process.env.WORDPRESS_CREDENTIALS_SECRET?.trim());
}

export function encryptWpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptWpSecret(stored: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = stored.split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
