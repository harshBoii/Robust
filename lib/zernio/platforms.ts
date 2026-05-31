import type { SocialProvider } from '@/app/generated/prisma/client';

export type ZernioPlatform = 'twitter' | 'linkedin' | 'reddit';

const PROVIDER_TO_ZERNIO: Record<SocialProvider, ZernioPlatform> = {
  X: 'twitter',
  LINKEDIN: 'linkedin',
  REDDIT: 'reddit',
};

const ZERNIO_TO_PROVIDER: Record<ZernioPlatform, SocialProvider> = {
  twitter: 'X',
  linkedin: 'LINKEDIN',
  reddit: 'REDDIT',
};

export function toZernioPlatform(provider: SocialProvider): ZernioPlatform {
  return PROVIDER_TO_ZERNIO[provider];
}

export function fromZernioPlatform(platform: string): SocialProvider | null {
  if (platform === 'twitter' || platform === 'linkedin' || platform === 'reddit') {
    return ZERNIO_TO_PROVIDER[platform];
  }
  return null;
}

export const ZERNIO_SOCIAL_PROVIDERS: SocialProvider[] = ['X', 'LINKEDIN', 'REDDIT'];
