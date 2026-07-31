'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { BrandMark } from '../BrandMark';
import { useLenis } from '../LenisScroll';
import { scrollToSection } from '../scroll-to';

const NAV_LINKS = [
  { href: '#features', label: 'Overview' },
  { href: '#setup', label: 'Setup' },
  { href: '#assistant', label: 'Assistant' },
  { href: '#intelligence', label: 'Intelligence' },
  { href: '#roi', label: 'Value' },
] as const;

export function LandingNav() {
  const lenis = useLenis();
  // The hero is dark and full-bleed, so the bar inverts until the page turns white.
  const [onDark, setOnDark] = useState(true);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      // flips once the cloud wash has actually whitened the strip behind the bar
      trigger: '.hero-panel',
      start: 'bottom 28%',
      onEnter: () => setOnDark(false),
      onLeaveBack: () => setOnDark(true),
    });

    return () => trigger.kill();
  }, []);

  return (
    <nav className={onDark ? 'nav-dark' : undefined}>
      <div className="nv">
        <Link className="brand" href="/landing">
          <BrandMark className="mark" />
          Robust
        </Link>
        <div className="nlinks">
          {NAV_LINKS.map(({ href, label }) => (
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
        <div className="ncta">
          <Link className="pill pill-o pill-sm" href="/login">
            Sign in
          </Link>
          <Link className="pill pill-b pill-sm" href="/signup">
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
