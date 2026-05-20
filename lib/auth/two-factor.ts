import 'server-only';

import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

import { decryptTwoFactorSecret, encryptTwoFactorSecret } from '@/lib/auth/two-factor-crypto';
import { prisma } from '@/lib/prisma';

const APP_NAME = 'Robust';

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export async function buildTwoFactorQrDataUrl(secret: string, accountLabel: string): Promise<string> {
  const otpauth = generateURI({
    issuer: APP_NAME,
    label: accountLabel,
    secret,
  });
  return QRCode.toDataURL(otpauth, { margin: 1, width: 200 });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = await verify({ secret, token: normalized });
  return result.valid;
}

export async function getCompanyTwoFactorSecret(companyId: string): Promise<string | null> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { twoFactorSecret: true },
  });
  if (!row?.twoFactorSecret) return null;
  return decryptTwoFactorSecret(row.twoFactorSecret);
}

export async function storePendingTwoFactorSecret(companyId: string, secret: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: { twoFactorSecret: encryptTwoFactorSecret(secret) },
  });
}

export async function enableTwoFactor(companyId: string, secret: string, code: string): Promise<boolean> {
  if (!(await verifyTotpCode(secret, code))) return false;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptTwoFactorSecret(secret),
    },
  });
  return true;
}

export async function disableTwoFactor(companyId: string, code: string): Promise<boolean> {
  const secret = await getCompanyTwoFactorSecret(companyId);
  if (!secret || !(await verifyTotpCode(secret, code))) return false;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  });
  return true;
}

export async function verifyCompanyTotp(companyId: string, code: string): Promise<boolean> {
  const secret = await getCompanyTwoFactorSecret(companyId);
  if (!secret) return false;
  return verifyTotpCode(secret, code);
}
