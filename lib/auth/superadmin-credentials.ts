import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getSuperadminEnvCredentials(): {
  userName: string;
  password: string;
} | null {
  const userName = process.env.SUPERADMIN_USERNAME?.trim();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!userName || !password) return null;
  return { userName, password };
}

export function isSuperadminCredentialsConfigured(): boolean {
  return getSuperadminEnvCredentials() !== null;
}

export function isSuperadminCredentials(userName: string, password: string): boolean {
  const creds = getSuperadminEnvCredentials();
  if (!creds) return false;
  return safeEqual(userName.trim(), creds.userName) && safeEqual(password, creds.password);
}
