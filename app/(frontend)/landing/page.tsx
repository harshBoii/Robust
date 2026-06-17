import type { Metadata } from 'next';

import { LandingPage } from '@/app/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Robust — The marketing system that runs itself',
  description:
    'Paid, organic, creative, and competitive intelligence — one intelligent system, working while your team thinks bigger.',
  alternates: { canonical: '/landing' },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LandingPage />;
}
