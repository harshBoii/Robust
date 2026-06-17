'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { FadeIn } from '../FadeIn';

const ROBUST_COST = 7512;

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function RoiSection() {
  const [teamSize, setTeamSize] = useState(2);
  const [salary, setSalary] = useState(75_000);
  const [toolSpend, setToolSpend] = useState(2000);

  const { saved, current } = useMemo(() => {
    const currentCost = teamSize * salary * 1.3 + toolSpend * 12;
    const savedAmount = Math.max(currentCost - ROBUST_COST, 0);
    return { saved: savedAmount, current: currentCost };
  }, [teamSize, salary, toolSpend]);

  return (
    <section className="sec" id="roi" style={{ background: 'var(--fog)' }}>
      <div className="shell">
        <FadeIn className="kicker">The math</FadeIn>
        <FadeIn>
          <h2 className="title">See what it gives back.</h2>
        </FadeIn>
        <div className="roi">
          <FadeIn className="roi-sliders">
            <div>
              <div className="rs-top">
                <span className="rs-name">Marketers on the team</span>
                <span className="rs-val">{teamSize}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="rs-top">
                <span className="rs-name">Average salary</span>
                <span className="rs-val">${salary.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={30_000}
                max={150_000}
                step={5000}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
              />
            </div>
            <div>
              <div className="rs-top">
                <span className="rs-name">Tools & agencies monthly</span>
                <span className="rs-val">${toolSpend.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={500}
                max={10_000}
                step={500}
                value={toolSpend}
                onChange={(e) => setToolSpend(Number(e.target.value))}
              />
            </div>
          </FadeIn>
          <FadeIn className="roi-out">
            <div className="lbl">Freed up every year</div>
            <div className="roi-big">{money(saved)}</div>
            <div className="roi-sub">Real budget back in your hands</div>
            <div className="roi-split">
              <div className="roi-half">
                <div className="l">Today</div>
                <div className="v">{money(current)}</div>
              </div>
              <div className="roi-half hl">
                <div className="l">With Robust</div>
                <div className="v">{money(ROBUST_COST)}</div>
              </div>
            </div>
            <div className="roi-foot">
              <Link className="pill pill-w" href="/signup" style={{ width: '100%' }}>
                Get started
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
