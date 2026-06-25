import 'server-only';

import { Agent, fetch as undiciFetch } from 'undici';

import { prisma } from '@/lib/prisma';
import { logMicroserviceResponse } from '@/lib/microservice/log-response';
import { buildBountyScanInput } from '@/lib/geo/bounty/buildBountyScanInput';
import {
  applyBountyOutput,
  parseBountyMicroservicePayload,
} from '@/lib/geo/bounty/applyBountyOutput';

const bountyDispatcher = new Agent({
  headersTimeout: 420_000,
  bodyTimeout: 600_000,
});

type BountyPostInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

async function fetchBountyWithRetry(url: string, init: BountyPostInit, retries = 2) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await undiciFetch(url, {
        ...init,
        dispatcher: bountyDispatcher,
      });
    } catch (err) {
      lastErr = err;
      const code =
        (err as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (err as { code?: string })?.code;
      const isHeaderTimeout = code === 'UND_ERR_HEADERS_TIMEOUT';
      const isFetchFailed = String((err as Error)?.message ?? '').includes('fetch failed');
      if (attempt >= retries || (!isHeaderTimeout && !isFetchFailed)) throw err;
      await new Promise((r) => setTimeout(r, 750 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

export async function scanBountyJob(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Company not found: ${companyId}`);

  const input = await buildBountyScanInput(companyId);

  const base = process.env.MICROSERVICE_URL;
  if (!base) throw new Error('MICROSERVICE_URL is not configured');

  const res = await fetchBountyWithRetry(`${base.replace(/\/$/, '')}/company/bounty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[microservice:bounty-scan] error', { status: res.status, body: text });
    throw new Error(`Bounty microservice failed (${res.status}): ${text}`);
  }

  const raw = await res.json();
  logMicroserviceResponse('bounty-scan', raw);
  const bountyOutput = parseBountyMicroservicePayload(raw);
  if (!bountyOutput) throw new Error('Invalid bounty response');

  const { summary } = await applyBountyOutput(prisma, company, bountyOutput);

  return {
    input,
    topicsDiscovered: summary.total_niches ?? bountyOutput.niches.length,
    promptsDiscovered: summary.total_prompts ?? 0,
    summary,
  };
}
