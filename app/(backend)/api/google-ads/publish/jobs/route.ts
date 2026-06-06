import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const idsParam = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ jobs: [] });

  const jobs = await prisma.googleAdPublishJob.findMany({
    where: {
      companyId: session.companyId,
      ...(ids.length ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      status: true,
      campaignType: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      scheduledAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Support SSE streaming for real-time updates
  const stream = req.nextUrl.searchParams.get('stream');
  if (stream === '1' && ids.length) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        send({ jobs });

        // Poll for up to 5 minutes
        const deadline = Date.now() + 5 * 60 * 1000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2000));
          const updated = await prisma.googleAdPublishJob.findMany({
            where: { id: { in: ids }, companyId: session.companyId },
            select: {
              id: true,
              status: true,
              lastError: true,
              completedAt: true,
            },
          });
          send({ jobs: updated });
          const allDone = updated.every(
            (j) => j.status === 'PUBLISHED' || j.status === 'FAILED' || j.status === 'CANCELLED',
          );
          if (allDone) break;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  return NextResponse.json({ jobs });
}
