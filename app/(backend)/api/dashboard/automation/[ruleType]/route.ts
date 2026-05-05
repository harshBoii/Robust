import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const RULE_TYPES = [
  'AUTO_PAUSE',
  'FATIGUE_ALERT',
  'BUDGET_PACING',
  'SPEND_CONCENTRATION',
  'WINNER_AMPLIFICATION',
] as const;

type RuleType = (typeof RULE_TYPES)[number];

function isRuleType(v: string): v is RuleType {
  return (RULE_TYPES as readonly string[]).includes(v);
}

type PatchBody = {
  isEnabled?: unknown;
  threshold?: unknown;
  window?: unknown;
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ruleType: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ruleType } = await context.params;
  if (!isRuleType(ruleType)) {
    return NextResponse.json({ error: 'Invalid ruleType' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: {
    isEnabled?: boolean;
    threshold?: number | null;
    window?: number | null;
  } = {};

  if (typeof body.isEnabled === 'boolean') data.isEnabled = body.isEnabled;

  if (typeof body.threshold === 'number') {
    data.threshold = Number.isFinite(body.threshold) ? body.threshold : null;
  } else if (body.threshold === null) {
    data.threshold = null;
  }

  if (typeof body.window === 'number') {
    data.window = Number.isFinite(body.window)
      ? Math.max(1, Math.trunc(body.window))
      : null;
  } else if (body.window === null) {
    data.window = null;
  }

  const updated = await prisma.adAutomationRule.upsert({
    where: {
      companyId_ruleType: { companyId: session.companyId, ruleType },
    },
    create: {
      companyId: session.companyId,
      ruleType,
      isEnabled: data.isEnabled ?? true,
      threshold: data.threshold ?? null,
      window: data.window ?? null,
      requiresApproval: ruleType === 'WINNER_AMPLIFICATION',
    },
    update: data,
    select: {
      id: true,
      ruleType: true,
      isEnabled: true,
      threshold: true,
      window: true,
      requiresApproval: true,
      lastTriggeredAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ rule: updated });
}

