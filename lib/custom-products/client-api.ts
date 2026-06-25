import type { CustomProductDto } from '@/lib/custom-products/types';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export type ExtractWebsitePayload = {
  source: 'website';
  companyDomain: string;
};

export type ExtractImagePayload = {
  source: 'image';
  imageBase64: string;
  imageMimeType?: string;
};

export type ExtractPdfPayload = {
  source: 'pdf';
  pdfBase64: string;
};

export type ExtractCustomProductPayload =
  | ExtractWebsitePayload
  | ExtractImagePayload
  | ExtractPdfPayload;

export type ExtractCustomProductResponse = {
  product: CustomProductDto;
  extraction?: {
    sourceType?: string;
    rawContentLength?: number;
    tavilyScrapeData?: string;
  };
};

export async function extractCustomProduct(
  payload: ExtractCustomProductPayload,
): Promise<ExtractCustomProductResponse> {
  return json<ExtractCustomProductResponse>(
    await fetch('/api/profile/custom-products/extract', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
}
