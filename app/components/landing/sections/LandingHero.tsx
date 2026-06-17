'use client';

import Link from 'next/link';

import { ChevronRight } from '../ChevronRight';
import { FadeIn } from '../FadeIn';
import { useLenis } from '../LenisScroll';
import { scrollToSection } from '../scroll-to';

export function LandingHero() {
  const lenis = useLenis();

  return (
    <header className="hero">
      <div className="shell">
        <FadeIn className="eyebrow">Robust</FadeIn>
        <FadeIn>
          <h1 className="hl">The marketing system that runs itself.</h1>
        </FadeIn>
        <FadeIn>
          <p className="hsub">
            Paid, organic, creative, and competitive intelligence — one intelligent system, working
            while your team thinks bigger.
          </p>
        </FadeIn>
        <FadeIn>
          <div className="hactions">
            <Link className="pill pill-b" href="/signup">
              Get started
            </Link>
            <a
              className="lnk"
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(lenis, '#features');
              }}
            >
              See how it works <ChevronRight />
            </a>
          </div>
        </FadeIn>
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
