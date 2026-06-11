async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function dnaBase(brandId: string) {
  return `/api/brands/${brandId}/dna`;
}

export async function fetchVisualDna(brandId: string) {
  return json<{ visualDna: Record<string, unknown> | null }>(
    await fetch(`${dnaBase(brandId)}/visual`, { credentials: 'include' }),
  );
}

export async function saveVisualDna(brandId: string, body: Record<string, unknown>) {
  return json<{ visualDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/visual`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function generateVisualDna(brandId: string, landingPageUrl: string) {
  return json<{ visualDna: Record<string, unknown>; screenshotUrl?: string }>(
    await fetch(`${dnaBase(brandId)}/visual/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landingPageUrl }),
    }),
  );
}

export async function fetchCommunicationDna(brandId: string) {
  return json<{ communicationDna: Record<string, unknown> | null }>(
    await fetch(`${dnaBase(brandId)}/communication`, { credentials: 'include' }),
  );
}

export async function saveCommunicationDna(brandId: string, body: Record<string, unknown>) {
  return json<{ communicationDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/communication`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function generateCommunicationDna(brandId: string) {
  return json<{ communicationDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/communication/generate`, {
      method: 'POST',
      credentials: 'include',
    }),
  );
}

export async function analyzeCommunicationBlogs(brandId: string, blogUrls: string[]) {
  return json<{ communicationDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/communication/analyze-blogs`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blogUrls }),
    }),
  );
}

export async function fetchAudienceDna(brandId: string) {
  return json<{ audienceDna: Record<string, unknown> | null }>(
    await fetch(`${dnaBase(brandId)}/audience`, { credentials: 'include' }),
  );
}

export async function saveAudienceDna(brandId: string, body: Record<string, unknown>) {
  return json<{ audienceDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/audience`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function generateAudienceDna(brandId: string) {
  return json<{ audienceDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/audience/generate`, {
      method: 'POST',
      credentials: 'include',
    }),
  );
}

export async function fetchComplianceDna(brandId: string) {
  return json<{ complianceDna: Record<string, unknown> | null }>(
    await fetch(`${dnaBase(brandId)}/compliance`, { credentials: 'include' }),
  );
}

export async function saveComplianceDna(brandId: string, body: Record<string, unknown>) {
  return json<{ complianceDna: Record<string, unknown> }>(
    await fetch(`${dnaBase(brandId)}/compliance`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function extractComplianceDna(brandId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return json<{
    extracted: Record<string, unknown>;
    sourceFileUrl: string;
    sourceFileName: string;
  }>(
    await fetch(`${dnaBase(brandId)}/compliance/extract`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }),
  );
}
