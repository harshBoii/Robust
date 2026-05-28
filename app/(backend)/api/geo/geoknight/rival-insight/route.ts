import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { buildRivalAnalyzeMicroPayload } from '@/lib/geo/geoknight/buildRivalAnalyzeMicroPayload';
import type { InsightTopicInput } from '@/lib/geo/geoknight/types';

type FocusBody =
  | { kind: 'self'; displayName: string }
  | { kind: 'rival'; rivalCompanyId: string; displayName: string };

const MAX_INSIGHT_PROMPTS = 5;

export const dynamic = 'force-dynamic';

function buildCompanyOneLiner(row: {
  name: string;
  domain: string | null;
  description: string | null;
  brandEntity: { oneLiner: string | null } | null;
} | null): string {
  const brand = row?.brandEntity?.oneLiner?.trim();
  if (brand) return brand;

  const raw = row?.description?.trim();
  if (raw) {
    const oneLine = raw.replace(/\s+/g, ' ').trim();
    const dot = oneLine.indexOf('.');
    if (dot > 0 && dot < 280) {
      return oneLine.slice(0, dot + 1).trim();
    }
    if (oneLine.length <= 280) return oneLine;
    return `${oneLine.slice(0, 277).trim()}…`;
  }

  const name = row?.name?.trim() ?? '';
  const domain = row?.domain?.trim();
  if (name && domain) return `${name} (${domain})`;
  return name || '';
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const requesterCompanyId = session.companyId;
  const body = await req.json().catch(() => null);
  const focus = body?.focus as FocusBody | undefined;
  const topics = body?.topics as InsightTopicInput[] | undefined;

  if (!focus || (focus.kind !== 'self' && focus.kind !== 'rival')) {
    return NextResponse.json(
      { success: false, error: 'focus.kind must be "self" or "rival"' },
      { status: 400 },
    );
  }
  if (focus.kind === 'rival' && !String(focus.rivalCompanyId ?? '').trim()) {
    return NextResponse.json(
      { success: false, error: 'focus.rivalCompanyId is required for rival focus' },
      { status: 400 },
    );
  }
  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json(
      { success: false, error: 'topics must be a non-empty list' },
      { status: 400 },
    );
  }

  let rivalCompanyId: string | null = null;
  let rivalMeta: { name: string; domain: string | null } | null = null;

  const selfRow = await prisma.company.findUnique({
    where: { id: requesterCompanyId },
    select: {
      name: true,
      domain: true,
      description: true,
      brandEntity: { select: { oneLiner: true } },
    },
  });
  const requestingCompanyOneLiner = buildCompanyOneLiner(selfRow);

  if (focus.kind === 'rival') {
    rivalCompanyId = String(focus.rivalCompanyId).trim();
    const allowed = await prisma.companyRival.findUnique({
      where: {
        companyId_rivalCompanyId: {
          companyId: requesterCompanyId,
          rivalCompanyId,
        },
      },
      select: { id: true },
    });
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const rivalRow = await prisma.company.findUnique({
      where: { id: rivalCompanyId },
      select: { name: true, domain: true },
    });
    rivalMeta = {
      name: (rivalRow?.name ?? focus.displayName ?? '').trim() || focus.displayName.trim(),
      domain: rivalRow?.domain?.trim() || null,
    };
  }

  const base = process.env.MICROSERVICE_URL;
  if (!base) {
    return NextResponse.json(
      { success: false, error: 'MICROSERVICE_URL is not configured' },
      { status: 500 },
    );
  }

  const focusName = String(focus.displayName ?? '').trim();
  const topicPayload = buildRivalAnalyzeMicroPayload(topics, focusName, MAX_INSIGHT_PROMPTS);

  const microPayload: Record<string, unknown> = {
    requestingCompany: {
      oneLiner: requestingCompanyOneLiner,
    },
    ...(focus.kind === 'rival' && rivalMeta ? { rivalCompany: rivalMeta } : {}),
    ...topicPayload,
  };

  let promptCount = 0;
  for (const value of Object.values(microPayload)) {
    if (
      value &&
      typeof value === 'object' &&
      'prompts' in value &&
      Array.isArray((value as { prompts: unknown[] }).prompts)
    ) {
      promptCount += (value as { prompts: unknown[] }).prompts.length;
    }
  }
  if (promptCount === 0) {
    return NextResponse.json(
      { success: false, error: 'No prompts available to analyze after filtering.' },
      { status: 400 },
    );
  }

  const url = `${base.replace(/\/+$/, '')}/rival/analyze`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(microPayload),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Rival analyze microservice failed', status: res.status, body: json },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, result: json });
  } catch (err) {
    console.error('[geo/geoknight/rival-insight] microservice error:', err);
    return NextResponse.json(
      { success: false, error: 'Error contacting microservice', details: (err as Error).message },
      { status: 502 },
    );
  }
}
