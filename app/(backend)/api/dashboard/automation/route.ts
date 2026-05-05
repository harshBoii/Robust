import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_RULES: Array<{
  ruleType:
    | 'AUTO_PAUSE'
    | 'FATIGUE_ALERT'
    | 'BUDGET_PACING'
    | 'SPEND_CONCENTRATION'
    | 'WINNER_AMPLIFICATION';
  isEnabled: boolean;
  threshold: number | null;
  window: number | null;
  requiresApproval: boolean;
}> = [
  // CPI ceiling is per-campaign/company configurable, so default a reasonable placeholder.
  { ruleType: 'AUTO_PAUSE', isEnabled: true, threshold: 10, window: 3, requiresApproval: false },
  // CTR drop percent (30% WoW). Use threshold as percent-drop (0.30).
  { ruleType: 'FATIGUE_ALERT', isEnabled: true, threshold: 0.3, window: 7, requiresApproval: false },
  // Budget pacing fraction before noon (40%). Threshold stored as fraction (0.4).
  { ruleType: 'BUDGET_PACING', isEnabled: true, threshold: 0.4, window: null, requiresApproval: false },
  // Spend concentration fraction (60%). Threshold stored as fraction (0.6).
  { ruleType: 'SPEND_CONCENTRATION', isEnabled: true, threshold: 0.6, window: 1, requiresApproval: false },
  // Winner CPI target (company-level) but always needs manual approval.
  { ruleType: 'WINNER_AMPLIFICATION', isEnabled: true, threshold: 10, window: 7, requiresApproval: true },
];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rules = await prisma.adAutomationRule.findMany({
    where: { companyId: session.companyId },
    orderBy: { ruleType: 'asc' },
    select: {
      id: true,
      ruleType: true,
      isEnabled: true,
      threshold: true,
      window: true,
      requiresApproval: true,
      lastTriggeredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ rules });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingCount = await prisma.adAutomationRule.count({
    where: { companyId: session.companyId },
  });

  if (existingCount === 0) {
    await prisma.adAutomationRule.createMany({
      data: DEFAULT_RULES.map((r) => ({
        companyId: session.companyId,
        ruleType: r.ruleType,
        isEnabled: r.isEnabled,
        threshold: r.threshold,
        window: r.window,
        requiresApproval: r.requiresApproval,
      })),
    });
  }

  const rules = await prisma.adAutomationRule.findMany({
    where: { companyId: session.companyId },
    orderBy: { ruleType: 'asc' },
    select: {
      id: true,
      ruleType: true,
      isEnabled: true,
      threshold: true,
      window: true,
      requiresApproval: true,
      lastTriggeredAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ rules });
}

