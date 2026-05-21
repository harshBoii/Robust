import 'server-only';

import { prisma } from '@/lib/prisma';

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
  { ruleType: 'AUTO_PAUSE', isEnabled: true, threshold: 10, window: 3, requiresApproval: false },
  { ruleType: 'FATIGUE_ALERT', isEnabled: true, threshold: 0.3, window: 7, requiresApproval: false },
  { ruleType: 'BUDGET_PACING', isEnabled: true, threshold: 0.4, window: null, requiresApproval: false },
  { ruleType: 'SPEND_CONCENTRATION', isEnabled: true, threshold: 0.6, window: 1, requiresApproval: false },
  { ruleType: 'WINNER_AMPLIFICATION', isEnabled: true, threshold: 10, window: 7, requiresApproval: true },
];

export async function ensureDefaultAutomationRules(companyId: string): Promise<void> {
  const count = await prisma.adAutomationRule.count({ where: { companyId } });
  if (count > 0) return;

  await prisma.adAutomationRule.createMany({
    data: DEFAULT_RULES.map((r) => ({
      companyId,
      ruleType: r.ruleType,
      isEnabled: r.isEnabled,
      threshold: r.threshold,
      window: r.window,
      requiresApproval: r.requiresApproval,
    })),
  });
}
