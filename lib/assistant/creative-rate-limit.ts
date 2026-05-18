import 'server-only';

import { prisma } from '@/lib/prisma';

const DEFAULT_CAP = 20;

function dailyCap(): number {
  const raw = process.env.ASSISTANT_CREATIVE_DAILY_CAP;
  const n = raw ? parseInt(raw, 10) : DEFAULT_CAP;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

function utcDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Atomically increment today's usage and enforce daily cap.
 * Rejects (throws) when count exceeds cap after increment.
 */
export async function assertCreativeSuggestAllowed(
  companyId: string,
): Promise<{ remaining: number; count: number }> {
  const cap = dailyCap();
  const date = utcDateOnly();

  const rows = await prisma.$queryRaw<[{ count: number }]>`
    INSERT INTO assistant_creative_usage ("companyId", date, count)
    VALUES (${companyId}, ${date}::date, 1)
    ON CONFLICT ("companyId", date)
    DO UPDATE SET count = assistant_creative_usage.count + 1
    RETURNING count
  `;

  const count = Number(rows[0]?.count ?? 1);
  if (count > cap) {
    throw new CreativeRateLimitError(cap);
  }

  return { remaining: Math.max(0, cap - count), count };
}

export class CreativeRateLimitError extends Error {
  readonly cap: number;

  constructor(cap: number) {
    super(`Daily creative analysis limit reached (${cap} per day). Try again tomorrow.`);
    this.name = 'CreativeRateLimitError';
    this.cap = cap;
  }
}
