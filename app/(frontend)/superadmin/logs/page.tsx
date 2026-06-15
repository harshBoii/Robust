import type { Metadata } from 'next';

import MetaApiLogsClient from '@/app/components/superadmin/MetaApiLogsClient';

export const metadata: Metadata = {
  title: 'Meta API Logs · Superadmin',
  robots: { index: false, follow: false },
};

export default function SuperadminMetaLogsPage() {
  return <MetaApiLogsClient />;
}
