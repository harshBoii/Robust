import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  isMetaConnected,
  ORGANIC_LANDING_PATH,
  PAID_GROWTH_LANDING_PATH,
} from '@/lib/nav/paid-growth';

/**
 * Decide where a signed-in user should land.
 *
 * Resolved server-side at every entry point (login, 2FA, signup, `/`) so a user without a
 * Meta integration never gets dropped onto the Paid Growth dashboard, which cannot render
 * without one.
 */
export async function resolveLandingPath(companyId: string): Promise<string> {
  try {
    const meta = await prisma.metaIntegration.findUnique({
      where: { companyId },
      select: { adAccountId: true, fbPageId: true },
    });
    return isMetaConnected(meta) ? PAID_GROWTH_LANDING_PATH : ORGANIC_LANDING_PATH;
  } catch {
    // Never block a sign-in on this lookup; the section guard still catches it.
    return PAID_GROWTH_LANDING_PATH;
  }
}
