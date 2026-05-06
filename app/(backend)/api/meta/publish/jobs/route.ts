import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseIds(req: NextRequest): string[] {
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ids = parseIds(req);
  if (!ids.length) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });

  const jobs = await prisma.adPublishJob.findMany({
    where: { id: { in: ids }, companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      lastError: true,
      metaAdDbId: true,
      createdAt: true,
      updatedAt: true,
      asset: { select: { id: true, title: true, thumbnailUrl: true, assetType: true } },
      campaign: { select: { id: true, name: true } },
      adSet: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ jobs });
}

// SSE version: /api/meta/publish/jobs/sse?ids=...
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ids = parseIds(req);
  if (!ids.length) return NextResponse.json({ error: 'Missing ids' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let active = true;
      const poll = async () => {
        if (!active) return;

        const jobs = await prisma.adPublishJob.findMany({
          where: { id: { in: ids }, companyId: session.companyId },
          select: { id: true, status: true, lastError: true, updatedAt: true, metaAdDbId: true },
        });

        send({ jobs });

        const allDone = jobs.every((j) => j.status === 'PUBLISHED' || j.status === 'FAILED' || j.status === 'CANCELLED');
        if (allDone) {
          send({ done: true });
          controller.close();
          return;
        }

        setTimeout(poll, 3000);
      };

      await poll();

      req.signal.addEventListener('abort', () => {
        active = false;
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

