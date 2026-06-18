import type { Metadata } from 'next';

import SuperadminHomeClient from '@/app/components/superadmin/SuperadminHomeClient';

export const metadata: Metadata = {
  title: 'Home · Superadmin',
  robots: { index: false },
};

export default function SuperadminHomePage() {
  return <SuperadminHomeClient />;
}
