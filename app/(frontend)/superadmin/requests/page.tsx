import type { Metadata } from 'next';

import AccessRequestsClient from '@/app/components/superadmin/AccessRequestsClient';

export const metadata: Metadata = {
  title: 'Access Requests · Superadmin',
  robots: { index: false, follow: false },
};

export default function SuperadminAccessRequestsPage() {
  return <AccessRequestsClient />;
}
