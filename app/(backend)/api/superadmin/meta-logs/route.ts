import { NextResponse } from 'next/server';

import { jsonSafe } from '@/lib/json-safe';
import {
  getMetaApiLogStats,
  listMetaApiLogs,
  safeMetaApiLogsQuery,
  searchCompaniesForMetaLogs,
} from '@/lib/superadmin/meta-api-logs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId')?.trim() ?? '';
  const cursor = searchParams.get('cursor')?.trim() || null;
  const limitRaw = Number(searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
  }

  const result = await safeMetaApiLogsQuery(async () => {
    const [stats, logs] = await Promise.all([
      getMetaApiLogStats(companyId),
      listMetaApiLogs({ companyId, cursor, limit }),
    ]);
    return { stats, logs };
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, migrationRequired: result.migrationRequired ?? false },
      { status: result.migrationRequired ? 503 : 500 },
    );
  }

  return NextResponse.json(jsonSafe(result.data));
}
