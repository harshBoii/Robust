import type { Metadata } from 'next';
import { DM_Sans, Inter, Sora,Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

/* ── Sora → headings (--font-heading) ── */
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});
/* ── DM Sans → UI labels / buttons / badges (--font-accent) ── */
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-accent',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Robust',
  description: 'Company workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}