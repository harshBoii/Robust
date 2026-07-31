'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useLayoutEffect, useRef } from 'react';

import { ChevronRight } from '../ChevronRight';
import { FadeIn } from '../FadeIn';
import { useLenis } from '../LenisScroll';
import { scrollToSection } from '../scroll-to';

const HEADLINE = 'The marketing system that runs itself.';

/** Splits a line into word-sized masks so each word can slide up out of its own clip. */
function MaskedWords({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span className="hw" key={`${word}-${i}`}>
          <span className="hw-i">{word}</span>
        </span>
      ))}
    </>
  );
}

export function LandingHero() {
  const lenis = useLenis();
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context((self) => {
      const q = self.selector as (sel: string) => HTMLElement[];

      // Restate the CSS start-state in gsap's own units so every transform
      // it later touches is normalised (the CSS values only exist to stop a
      // flash of un-animated hero before hydration).
      gsap.set('.hero-sky', { yPercent: -38 });
      gsap.set('.hw-i', { yPercent: 110, opacity: 0 });
      gsap.set('.hero-puff', { scale: 0.55, opacity: 0.05 });
      gsap.set(
        ['.hero-eyebrow', '.hero-sub', '.hero-actions', '.hero-quote', '.hero-visual-foot'],
        { y: 18, opacity: 0 },
      );

      if (reduced) {
        gsap.set(q('.hero-anim'), { opacity: 1, y: 0 });
        gsap.set(q('.hw-i'), { yPercent: 0, opacity: 1 });
        gsap.set(q('.hero-visual'), { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.set(q('.hero-puff'), { opacity: 0.9, scale: 1.6 });
        gsap.set(q('.hero-sheet'), { opacity: 1 });
        gsap.set(q('.hero-wisp'), { opacity: 0.45 });
        return;
      }

      /* ---------- entrance: nothing lands at the same moment ---------- */
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.12 });

      tl.fromTo(
        '.hero-visual',
        { clipPath: 'inset(0% 0% 100% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'power2.inOut' },
        0,
      )
        .fromTo(
          '.hero-visual-media',
          { scale: 1.24 },
          { scale: 1, duration: 2.4, ease: 'power2.out' },
          0,
        )
        .to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.9 }, 0.35)
        .to(
          '.hw-i',
          { yPercent: 0, opacity: 1, duration: 1.15, stagger: 0.055, ease: 'power4.out' },
          0.45,
        )
        .to('.hero-sub', { opacity: 1, y: 0, duration: 1 }, 0.95)
        .to('.hero-quote', { opacity: 1, y: 0, duration: 1.1 }, 1)
        .to('.hero-actions', { opacity: 1, y: 0, duration: 0.9 }, 1.1)
        .to('.hero-visual-foot', { opacity: 1, y: 0, duration: 0.9 }, 1.18)
        .to('.hero-scrollcue', { opacity: 1, duration: 0.8 }, 1.4);

      /* ---------- scroll: the vista drifts slower than the page ---------- */
      const panelScrub = {
        trigger: '.hero-panel',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      } as const;

      gsap.to('.hero-visual-media', {
        yPercent: 9,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: panelScrub,
      });

      gsap.to('.hero-copy', {
        yPercent: -14,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: panelScrub,
      });

      /* ---------- scroll: cloud bank blooms and washes the page white ---------- */
      gsap
        .timeline({
          scrollTrigger: {
            trigger: '.hero-dissolve',
            start: 'top 70%',
            end: 'bottom 60%',
            scrub: 0.9,
          },
        })
        .to('.hero-sky', { yPercent: -72, ease: 'none' }, 0)
        .to(
          '.hero-puff',
          {
            opacity: 0.92,
            scale: (i: number) => 1.5 + i * 0.14,
            xPercent: (i: number) => (i % 2 === 0 ? -13 : 13),
            ease: 'power1.out',
            stagger: { each: 0.06, from: 'center' },
          },
          0,
        )
        .to('.hero-wisp', { opacity: 0.5, scale: 1.35, ease: 'none' }, 0)
        // the sheet goes solid before the bank finishes drifting, so the seam
        // between the dark panel and the white page is buried, not revealed
        .to('.hero-sheet', { opacity: 1, duration: 0.55, ease: 'power1.in' }, 0.15);

      /* ---------- ambient drift so the sky never sits perfectly still ---------- */
      q('.hero-puff').forEach((puff, i) => {
        gsap.to(puff, {
          xPercent: `+=${i % 2 === 0 ? 5 : -5}`,
          yPercent: `+=${i % 3 === 0 ? -3.5 : 3}`,
          duration: 16 + i * 2.5,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header className="hero" ref={rootRef}>
      <div className="hero-panel">
        <figure className="hero-visual">
          <div className="hero-visual-media" />
          <div className="hero-visual-scrim" />

          <figcaption className="hero-quote hero-anim">Work less. Think bigger.</figcaption>

          <div className="hero-visual-foot hero-anim">
            <span>tryrobust.com</span>
            <span className="hero-visual-tags">
              paid <i>✦</i> organic <i>✦</i> creative
            </span>
          </div>
        </figure>

        <div className="hero-copy">
          <p className="hero-eyebrow hero-anim">Robust</p>

          <h1 className="hero-h1">
            <MaskedWords text={HEADLINE} />
          </h1>

          <p className="hero-sub hero-anim">
            Paid, organic, creative, and competitive intelligence — one intelligent system, working
            while your team thinks bigger.
          </p>

          <div className="hero-actions hero-anim">
            <Link className="pill pill-b" href="/signup">
              Get started
            </Link>
            <a
              className="pill pill-ghost"
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(lenis, '#features');
              }}
            >
              See how it works <ChevronRight />
            </a>
          </div>
        </div>

        <div className="hero-scrollcue hero-anim" aria-hidden="true">
          <span />
        </div>
      </div>

      {/* the dark hero dissolves into the white page through a bank of cloud */}
      <div className="hero-dissolve" aria-hidden="true">
        <div className="hero-sheet" />
        <div className="hero-sky">
          <svg className="hero-wisp" viewBox="0 0 600 300" preserveAspectRatio="none">
            <defs>
              <filter id="heroCloudNoise" x="0" y="0" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.011 0.028"
                  numOctaves="5"
                  seed="7"
                  result="noise"
                />
                <feColorMatrix
                  in="noise"
                  type="matrix"
                  values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.1 0 0 0 -0.35"
                />
              </filter>
              <linearGradient id="heroCloudFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.2" />
              </linearGradient>
              <mask id="heroCloudMask">
                <rect width="600" height="300" fill="url(#heroCloudFade)" />
              </mask>
            </defs>
            <g mask="url(#heroCloudMask)">
              <rect width="600" height="300" filter="url(#heroCloudNoise)" />
            </g>
          </svg>

          <span className="hero-puff hp1" />
          <span className="hero-puff hp2" />
          <span className="hero-puff hp3" />
          <span className="hero-puff hp4" />
          <span className="hero-puff hp5" />
          <span className="hero-puff hp6" />
        </div>
      </div>

      <div className="stage">
        <div className="stage-glow" />
        <div className="wide">
          <FadeIn className="appwin">
            <div className="appbar">
              <div className="tl">
                <i />
                <i />
                <i />
              </div>
              <span className="appbar-title">Robust</span>
              <div className="appbar-seg">
                <span className="on">Today</span>
                <span>Week</span>
                <span>Month</span>
              </div>
            </div>
            <div className="appbody">
              <aside className="appside">
                <div className="aslink on">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="7" height="9" rx="1.5" />
                    <rect x="14" y="3" width="7" height="5" rx="1.5" />
                    <rect x="14" y="12" width="7" height="9" rx="1.5" />
                    <rect x="3" y="16" width="7" height="5" rx="1.5" />
                  </svg>
                  Overview
                </div>
                <div className="aslink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 17l5-5 4 3 8-9" />
                    <path d="M21 6v5h-5" />
                  </svg>
                  Paid
                </div>
                <div className="aslink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
                  </svg>
                  Organic
                </div>
                <div className="aslink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
                  </svg>
                  Creative
                </div>
                <div className="aslink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  Rivals
                </div>
                <div className="assist-card">
                  <div className="orb" />
                  <span>Ask Robust anything</span>
                </div>
              </aside>
              <main className="appmain">
                <div className="am-head">
                  <div>
                    <div className="am-label">Net revenue · attributed</div>
                    <div className="am-metric">$634,210</div>
                    <div className="am-delta">
                      <svg viewBox="0 0 10 10" fill="none">
                        <path
                          d="M5 8V2M5 2L2 5M5 2l3 3"
                          stroke="#1c8c4e"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      18.4% vs last period
                    </div>
                  </div>
                  <div className="am-status">
                    <span className="statusdot" />
                    Running autonomously
                  </div>
                </div>
                <svg className="chart" viewBox="0 0 640 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="heroChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#0071e3" stopOpacity=".16" />
                      <stop offset="1" stopColor="#0071e3" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 96 C60 92 90 84 140 80 C200 75 230 66 290 58 C350 50 380 44 440 34 C500 24 540 18 640 8 L640 120 L0 120 Z"
                    fill="url(#heroChartGrad)"
                  />
                  <path
                    d="M0 96 C60 92 90 84 140 80 C200 75 230 66 290 58 C350 50 380 44 440 34 C500 24 540 18 640 8"
                    fill="none"
                    stroke="#0071e3"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <circle cx="640" cy="8" r="4" fill="#0071e3" />
                  <circle cx="640" cy="8" r="7" fill="#0071e3" fillOpacity=".18" />
                </svg>
                <div className="am-stats">
                  <div className="amst">
                    <div className="amst-v">4.2×</div>
                    <div className="amst-l">Blended ROAS</div>
                  </div>
                  <div className="amst">
                    <div className="amst-v">62 hrs</div>
                    <div className="amst-l">Saved this week</div>
                  </div>
                  <div className="amst">
                    <div className="amst-v">73%</div>
                    <div className="amst-l">AI search visibility</div>
                  </div>
                </div>
                <div className="am-rows">
                  <div className="amrow">
                    <div className="amrow-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                        <path d="M3 17l5-5 4 3 8-9" />
                      </svg>
                    </div>
                    <div className="amrow-nm">Meta — Summer launch</div>
                    <span className="amrow-tag live">Live</span>
                    <span className="amrow-v">5.2×</span>
                  </div>
                  <div className="amrow">
                    <div className="amrow-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4-4" />
                      </svg>
                    </div>
                    <div className="amrow-nm">Google — Performance Max</div>
                    <span className="amrow-tag live">Live</span>
                    <span className="amrow-v">7.1×</span>
                  </div>
                  <div className="amrow">
                    <div className="amrow-ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                        <path d="M4 4h16v12H4z" />
                        <path d="M4 20h16" />
                      </svg>
                    </div>
                    <div className="amrow-nm">Newsletter — Issue 12</div>
                    <span className="amrow-tag">Sent</span>
                    <span className="amrow-v">1.4K</span>
                  </div>
                </div>
              </main>
            </div>
          </FadeIn>
        </div>
      </div>
    </header>
  );
}
