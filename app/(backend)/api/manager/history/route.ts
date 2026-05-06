import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Kind = 'ad' | 'job';

export type HistoryRow = {
  kind: Kind;
  id: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  name: string;
  campaignName: string | null;
  adSetName: string | null;
  presetName: string | null;
  lastError: string | null;
  metaAdId: string | null;
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const status = (req.nextUrl.searchParams.get('status') ?? 'ALL').toUpperCase();
  const isMetaAdStatus = (s: string) => s === 'ACTIVE' || s === 'PAUSED' || s === 'ARCHIVED';
  const isJobStatus = (s: string) =>
    s === 'QUEUED' || s === 'PROCESSING' || s === 'PUBLISHED' || s === 'FAILED' || s === 'CANCELLED';

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ rows: [] satisfies HistoryRow[] });

  const [ads, jobs] = await Promise.all([
    prisma.metaAd.findMany({
      where: {
        metaIntegrationId: integration.id,
        ...(q
          ? {
              OR: [
                { metaAdId: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(status !== 'ALL' && status !== 'PROCESSING' && isMetaAdStatus(status)
          ? { status }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        metaAdId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        preset: { select: { id: true, name: true } },
        adSet: {
          select: {
            id: true,
            name: true,
            campaign: { select: { id: true, name: true } },
          },
        },
        creative: { select: { thumbnailUrl: true } },
      },
    }),
    prisma.adPublishJob.findMany({
      where: {
        companyId: session.companyId,
        metaIntegrationId: integration.id,
        ...(status === 'PROCESSING'
          ? { status: { in: ['QUEUED', 'PROCESSING'] } }
          : status !== 'ALL' && isJobStatus(status)
            ? { status }
            : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        lastError: true,
        metaAdDbId: true,
        asset: { select: { thumbnailUrl: true, title: true } },
        campaign: { select: { name: true } },
        adSet: { select: { name: true } },
        adPreset: { select: { name: true } },
        metaAd: { select: { metaAdId: true, name: true } },
      },
    }),
  ]);

  const rows: HistoryRow[] = [
    ...ads.map((a) => ({
      kind: 'ad' as const,
      id: a.metaAdId,
      metaAdId: a.metaAdId,
      status: (a.status ?? 'UNKNOWN') as string,
      createdAt: (a.createdAt ?? a.updatedAt).toISOString(),
      scheduledAt: null,
      thumbnailUrl: a.creative?.thumbnailUrl ?? null,
      name: a.name ?? a.metaAdId,
      campaignName: a.adSet?.campaign?.name ?? null,
      adSetName: a.adSet?.name ?? null,
      presetName: a.preset?.name ?? null,
      lastError: null,
    })),
    ...jobs.map((j) => ({
      kind: 'job' as const,
      id: j.id,
      metaAdId: j.metaAd?.metaAdId ?? null,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
      scheduledAt: j.scheduledAt ? j.scheduledAt.toISOString() : null,
      thumbnailUrl: j.asset.thumbnailUrl ?? null,
      name: j.metaAd?.name ?? j.asset.title ?? j.id,
      campaignName: j.campaign.name ?? null,
      adSetName: j.adSet.name ?? null,
      presetName: j.adPreset?.name ?? null,
      lastError: j.lastError ?? null,
    })),
  ];

  const filtered = q
    ? rows.filter((r) => {
        const hay = [
          r.id,
          r.name,
          r.campaignName ?? '',
          r.adSetName ?? '',
          r.presetName ?? '',
          r.metaAdId ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
    : rows;

  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ rows: filtered });
}

