'use client';

import { usePathname } from 'next/navigation';

import { MetaRequiredDialog } from '@/app/components/paidGrowth/MetaRequiredDialog';
import { isPaidGrowthPath } from '@/lib/nav/paid-growth';

/**
 * Gates the Paid Growth section behind a Meta connection.
 *
 * `metaConnected` is resolved server-side in the workspace layout rather than fetched here,
 * so the dialog is present on first paint — a client fetch would flash the broken dashboard
 * underneath before the guard appeared.
 */
export function PaidGrowthGuard({ metaConnected }: { metaConnected: boolean }) {
  const pathname = usePathname();

  if (metaConnected) return null;
  if (!isPaidGrowthPath(pathname)) return null;

  return <MetaRequiredDialog />;
}
