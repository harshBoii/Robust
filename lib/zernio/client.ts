import Zernio from '@zernio/node';

let client: Zernio | null = null;

export function isZernioConfigured(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY?.trim());
}

export function getZernioClient(): Zernio {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Zernio is not configured (ZERNIO_API_KEY missing)');
  }

  if (!client) {
    client = new Zernio({ apiKey });
  }

  return client;
}

export function zernioApiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Zernio request failed';
}
