import 'server-only';

import { prisma } from '@/lib/prisma';

export type MetaApiLogStats = {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number | null;
  last24hCalls: number;
  byOperation: Array<{
    operation: string;
    total: number;
    successCount: number;
    successRate: number;
  }>;
};

export type MetaApiLogRow = {
  id: string;
  method: string;
  path: string;
  operation: string | null;
  requestUrl: string;
  requestPayload: unknown;
  responseStatus: number;
  responseBody: unknown;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
};

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('meta_api_logs') || msg.includes('does not exist');
}

export async function searchCompaniesForMetaLogs(query: string) {
  const q = query.trim();
  if (!q) {
    return prisma.company.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
      take: 8,
    });
  }
  return prisma.company.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
    take: 10,
  });
}

export async function getMetaApiLogStats(companyId: string): Promise<MetaApiLogStats> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = { companyId };

  const [totalCalls, successCount, last24hCalls, avgRow, byOperationRaw] = await Promise.all([
    prisma.metaApiLog.count({ where }),
    prisma.metaApiLog.count({ where: { ...where, success: true } }),
    prisma.metaApiLog.count({ where: { ...where, createdAt: { gte: since24h } } }),
    prisma.metaApiLog.aggregate({
      where: { ...where, durationMs: { not: null } },
      _avg: { durationMs: true },
    }),
    prisma.metaApiLog.groupBy({
      by: ['operation'],
      where,
      _count: { _all: true },
    }),
  ]);

  const failureCount = totalCalls - successCount;
  const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 1000) / 10 : 0;

  const operationStats = await Promise.all(
    [...byOperationRaw]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 12)
      .map(async (row) => {
      const op = row.operation ?? 'unknown';
      const opSuccess = await prisma.metaApiLog.count({
        where: { companyId, operation: row.operation, success: true },
      });
      const total = row._count._all;
      return {
        operation: op,
        total,
        successCount: opSuccess,
        successRate: total > 0 ? Math.round((opSuccess / total) * 1000) / 10 : 0,
      };
    }),
  );

  return {
    totalCalls,
    successCount,
    failureCount,
    successRate,
    avgDurationMs: avgRow._avg.durationMs ?? null,
    last24hCalls,
    byOperation: operationStats,
  };
}

export async function listMetaApiLogs(input: {
  companyId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ rows: MetaApiLogRow[]; nextCursor: string | null }> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));

  const rows = await prisma.metaApiLog.findMany({
    where: { companyId: input.companyId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(input.cursor
      ? {
          cursor: { id: input.cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      method: true,
      path: true,
      operation: true,
      requestUrl: true,
      requestPayload: true,
      responseStatus: true,
      responseBody: true,
      success: true,
      errorMessage: true,
      durationMs: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id : null;

  return {
    rows: page.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function safeMetaApiLogsQuery<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; migrationRequired?: boolean }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (isMissingTableError(e)) {
      return {
        ok: false,
        error: 'meta_api_logs table not found. Run Prisma migration manually, then prisma generate.',
        migrationRequired: true,
      };
    }
    const message = e instanceof Error ? e.message : 'Query failed';
    return { ok: false, error: message };
  }
}
