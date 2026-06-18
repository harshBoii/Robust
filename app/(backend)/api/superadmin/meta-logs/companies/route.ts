import { NextResponse } from 'next/server';

import { requireSuperadminSession } from '@/lib/auth/superadmin-session';
import { jsonSafe } from '@/lib/json-safe';
import { safeMetaApiLogsQuery, searchCompaniesForMetaLogs } from '@/lib/superadmin/meta-api-logs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireSuperadminSession();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  const result = await safeMetaApiLogsQuery(() => searchCompaniesForMetaLogs(q));

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, migrationRequired: result.migrationRequired ?? false, companies: [] },
      { status: result.migrationRequired ? 503 : 500 },
    );
  }

  return NextResponse.json(jsonSafe({ companies: result.data }));
}
