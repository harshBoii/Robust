'use client';

import Link from 'next/link';

import { BrandMark } from '../BrandMark';
import { useLenis } from '../LenisScroll';
import { scrollToSection } from '../scroll-to';

const PRODUCT_LINKS = [
  { href: '#features', label: 'Overview' },
  { href: '#setup', label: 'Setup' },
  { href: '#assistant', label: 'Assistant' },
  { href: '#intelligence', label: 'Intelligence' },
] as const;

export function LandingFooter() {
  const lenis = useLenis();

  return (
    <footer>
      <div className="shell">
        <div className="foot-top">
          <div>
            <div className="foot-brand">
              <BrandMark className="mark" />
              Robust
            </div>
            <p
              style={{
                marginTop: 14,
                maxWidth: '30ch',
                color: 'var(--ink2)',
                fontSize: 13,
              }}
            >
              The marketing system that runs itself. Paid, organic, creative, and competitive
              intelligence in one place.
            </p>
          </div>
          <div className="fcol">
            <h5>Product</h5>
            {PRODUCT_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(lenis, href);
                }}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="fcol">
            <h5>Company</h5>
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Blog</a>
            <a href="#">Press</a>
          </div>
          <div className="fcol">
            <h5>Resources</h5>
            <a href="#">Docs</a>
            <a href="#">Support</a>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-and-conditions">Terms</Link>
          </div>
        </div>
        <div className="foot-legal">
          <span>Copyright © 2026 Robust. All rights reserved.</span>
          <span>Built for teams that move faster.</span>
        </div>
      </div>
    </footer>
  );
}
