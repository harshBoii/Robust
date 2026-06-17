import type { ReactNode } from 'react';

import { FadeIn } from '../FadeIn';

function TagDone({ children }: { children: ReactNode }) {
  return (
    <span className="done">
      <svg viewBox="0 0 10 10" fill="none" stroke="#5cd98a" strokeWidth="1.6">
        <path d="M2 5l2 2 4-5" />
      </svg>
      {children}
    </span>
  );
}

export function AssistantSection() {
  return (
    <section className="assist-sec" id="assistant">
      <div className="assist-glow" />
      <div className="shell" style={{ position: 'relative', zIndex: 2 }}>
        <FadeIn className="kicker">The assistant</FadeIn>
        <FadeIn>
          <h2 className="title">Just ask.</h2>
        </FadeIn>
        <FadeIn>
          <p className="deck">
            A single conversation that writes, ships, investigates, and reports — in the time it
            takes to describe it.
          </p>
        </FadeIn>
        <FadeIn className="convo">
          <div className="convo-top">
            <div className="orb an" />
            <div>
              <div className="convo-name">Robust</div>
              <div className="convo-st">Online — ready</div>
            </div>
          </div>
          <div className="convo-body">
            <div className="b b-u">
              Write our summer sale newsletter — 25% off. Make a 30-second film for it. And find
              where we&apos;re wasting spend.
            </div>
            <div className="b b-a">
              Newsletter drafted in your voice, 340 words. Film generated — script, scenes, and
              voiceover ready for Meta and YouTube. And I found $14,600 in dead Meta spend across
              three sets with zero conversions in a week. Pausing them saves about $490 weekly.
              <div className="b-tags">
                <TagDone>Newsletter</TagDone>
                <TagDone>Film</TagDone>
                <TagDone>$14.6K found</TagDone>
              </div>
            </div>
            <div className="b b-u">
              Pause them. Send the newsletter at 7. Post to LinkedIn and r/deals. What&apos;s our
              biggest rival running?
            </div>
            <div className="b b-a">
              Done — $490 a week recovered. Newsletter scheduled for 7:00 to 14,280 subscribers,
              LinkedIn and Reddit live. Your rival is running 34 creatives, mostly video, around
              $42K a month — but they&apos;re weak in AI search, where you lead by 14 points.
              I&apos;d push more answer-content to widen that gap.
              <div className="b-tags">
                <TagDone>Scheduled</TagDone>
                <TagDone>Posted</TagDone>
                <TagDone>Rival profiled</TagDone>
              </div>
            </div>
            <div className="typing2">
              <i />
              <i />
              <i />
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
