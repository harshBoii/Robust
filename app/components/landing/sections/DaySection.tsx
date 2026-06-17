import { FadeIn } from '../FadeIn';

export function DaySection() {
  return (
    <section className="sec">
      <div className="shell">
        <FadeIn className="kicker">A day, handled</FadeIn>
        <FadeIn>
          <h2 className="title">It works the hours you don&apos;t.</h2>
        </FadeIn>
        <div className="day">
          <FadeIn className="day-row">
            <div>
              <div className="day-t">8:00</div>
              <div className="day-tl">Morning</div>
            </div>
            <div>
              <div className="day-h">A brief before the first meeting.</div>
              <p className="day-p">
                Overnight results, best creative, AI-search standing, and a recommendation — ready
                before you open your laptop.
              </p>
            </div>
            <div className="day-card">
              <div className="dc-top">
                <span className="dc-lbl">Morning brief</span>
                <span className="dc-tag">Prepared overnight</span>
              </div>
              <div className="dc-kpis">
                <div>
                  <div className="dck-v">$102K</div>
                  <div className="dck-l">Revenue</div>
                </div>
                <div>
                  <div className="dck-v">4.8×</div>
                  <div className="dck-l">ROAS</div>
                </div>
                <div>
                  <div className="dck-v">+6.1%</div>
                  <div className="dck-l">Top CTR</div>
                </div>
              </div>
              <div className="assist-line">
                <div className="orb" style={{ width: 24, height: 24, flexShrink: 0 }} />
                <p>
                  <b>Robust</b> — Performance Max is 40% ahead. Moving $24K could add $97K. A rival
                  just shipped six new films; want a counter set?
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="day-row">
            <div>
              <div className="day-t">12:30</div>
              <div className="day-tl">Midday</div>
            </div>
            <div>
              <div className="day-h">An idea becomes a campaign.</div>
              <p className="day-p">
                A week of briefs and revisions, collapsed into one sentence. Approve, and it ships.
              </p>
            </div>
            <div className="day-card">
              <div className="dc-top">
                <span className="dc-lbl">Creative studio</span>
                <span className="dc-tag">4 made today</span>
              </div>
              <div className="dc-thumbs">
                <div className="dct">
                  <div className="dct-img">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <path d="M3 17l5-5 4 3 8-9" />
                    </svg>
                  </div>
                  <div className="dct-cap">Summer launch · 5.2×</div>
                </div>
                <div className="dct">
                  <div className="dct-img vid">
                    <svg viewBox="0 0 24 24" fill="#fff">
                      <path d="M9 7l8 5-8 5z" />
                    </svg>
                  </div>
                  <div className="dct-cap">Film · 30s · Ready</div>
                </div>
                <div className="dct">
                  <div className="dct-img">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <path d="M4 5h16v11H4z" />
                      <path d="M4 9h16" />
                    </svg>
                  </div>
                  <div className="dct-cap">Issue 14 · Sent</div>
                </div>
                <div className="dct">
                  <div className="dct-img">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                  </div>
                  <div className="dct-cap">Post · Scheduled</div>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="day-row">
            <div>
              <div className="day-t">20:00</div>
              <div className="day-tl">After hours</div>
            </div>
            <div>
              <div className="day-h">The night shift, covered.</div>
              <p className="day-p">
                Bids tuned, budget moved, content sent, citations checked — quietly, while everyone
                sleeps.
              </p>
            </div>
            <div className="day-card">
              <div className="dc-top">
                <span className="dc-lbl">Overnight run</span>
                <span className="dc-tag">In progress</span>
              </div>
              <div className="dc-tasks">
                <div className="dtask">
                  <svg viewBox="0 0 16 16" fill="none" stroke="#1c8c4e" strokeWidth="1.8">
                    <path d="M3 8l3 3 7-8" />
                  </svg>
                  <span className="nm">Budget moved to Performance Max</span>
                  <span className="st ok">Done</span>
                </div>
                <div className="dtask">
                  <svg viewBox="0 0 16 16" fill="none" stroke="#1c8c4e" strokeWidth="1.8">
                    <path d="M3 8l3 3 7-8" />
                  </svg>
                  <span className="nm">Paused 3 spending sets</span>
                  <span className="st ok">$490 saved</span>
                </div>
                <div className="dtask">
                  <span className="spinner" style={{ width: 15, height: 15 }} />
                  <span className="nm">Sending scheduled newsletter</span>
                  <span className="st">Now</span>
                </div>
                <div className="dtask">
                  <svg viewBox="0 0 16 16" fill="none" stroke="#86868b" strokeWidth="1.6">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3l2 1" />
                  </svg>
                  <span className="nm">AI-search citation scan</span>
                  <span className="st">Queued</span>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
