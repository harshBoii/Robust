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
  // Transparent at rest, but hero copy scrolls underneath — so it earns a scrim.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const invert = ScrollTrigger.create({
      // flips once the cloud wash has actually whitened the strip behind the bar
      trigger: '.hero-panel',
      start: 'bottom 28%',
      onEnter: () => setOnDark(false),
      onLeaveBack: () => setOnDark(true),
    });

    const scrim = ScrollTrigger.create({
      trigger: '.landing',
      start: 'top -60',
      end: 'max',
      onToggle: (self) => setScrolled(self.isActive),
    });

    return () => {
      invert.kill();
      scrim.kill();
    };
  }, []);

  return (
    <nav className={[onDark && 'nav-dark', scrolled && 'nav-scrolled'].filter(Boolean).join(' ')}>
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
