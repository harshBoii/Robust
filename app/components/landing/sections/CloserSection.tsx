'use client';

import Link from 'next/link';

import { ChevronRight } from '../ChevronRight';
import { FadeIn } from '../FadeIn';

export function CloserSection() {
  return (
    <section className="closer">
      <div className="shell">
        <FadeIn className="kicker-brand">Robust</FadeIn>
        <FadeIn>
          <h2 className="title">Give your team an unfair advantage.</h2>
        </FadeIn>
        <FadeIn>
          <p className="deck">
            Paid, organic, creative, and intelligence — running themselves, starting today.
          </p>
        </FadeIn>
        <FadeIn>
          <div className="closer-actions">
            <Link className="pill pill-b" href="/signup">
              Get started
            </Link>
            <Link className="lnk" href="/login" style={{ fontSize: 19 }}>
              Book a walkthrough <ChevronRight />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
