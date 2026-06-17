import { FadeIn } from '../FadeIn';

export function FeaturesBento() {
  return (
    <section className="sec" id="features">
      <div className="shell">
        <FadeIn className="kicker">One system. Every surface.</FadeIn>
        <FadeIn>
          <h2 className="title">Your whole marketing operation, working as one.</h2>
        </FadeIn>
        <FadeIn>
          <p className="deck">
            Not a stack of tools. A single intelligent system that plans, makes, runs, and watches —
            across every channel at once.
          </p>
        </FadeIn>
      </div>
      <div className="wide">
        <div className="bento">
          <FadeIn className="tile tile-lg tile-dark">
            <div className="t-eye">The assistant</div>
            <div className="orb lg an" style={{ marginBottom: 18 }} />
            <h3 className="t-h">Tell it what you want. It does the rest.</h3>
            <p className="t-sub">
              Write a campaign, generate a film, find wasted spend, profile a competitor. One
              instruction, and the work is done — end to end.
            </p>
          </FadeIn>

          <FadeIn className="tile tile-md tile-light">
            <div className="t-eye">Paid</div>
            <div className="t-ico" style={{ marginTop: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                <path d="M3 17l5-5 4 3 8-9" />
                <path d="M21 6v5h-5" />
              </svg>
            </div>
            <h3 className="t-h">Every bid, optimised.</h3>
            <p className="t-sub">
              Meta, Google, LinkedIn, TikTok — managed continuously, budget moving to whatever
              performs.
            </p>
          </FadeIn>

          <FadeIn className="tile tile-half tile-dark">
            <div className="t-eye">Creative</div>
            <h3 className="t-h" style={{ marginTop: 12 }}>
              It even shoots the film.
            </h3>
            <p className="t-sub">
              Script, scenes, and voiceover — a finished video ad, generated on request.
            </p>
            <div className="vidframe">
              <span className="vidtag">Generated</span>
              <div className="playbtn">
                <svg viewBox="0 0 16 16" fill="#fff">
                  <path d="M3 2l11 6-11 6z" />
                </svg>
              </div>
              <div className="vidmeta">
                <span>Script ✓</span>
                <span>Voiceover ✓</span>
                <span>Ready for Meta</span>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="tile tile-half tile-fog">
            <div className="t-eye">Assets</div>
            <h3 className="t-h" style={{ marginTop: 12 }}>
              Pick a template. It fills the rest.
            </h3>
            <p className="t-sub">
              Newsletters, blogs, posts, threads — drafted in your voice, on schedule.
            </p>
            <div className="assetmini">
              <div className="am-cell">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <path d="M4 5h16v11H4z" />
                  <path d="M4 9h16" />
                </svg>
                <b>Newsletter</b>
              </div>
              <div className="am-cell">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <path d="M5 3h9l5 5v13H5z" />
                  <path d="M14 3v5h5" />
                </svg>
                <b>Blog post</b>
              </div>
              <div className="am-cell">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <circle cx="8.5" cy="9" r="1.3" fill="#1d1d1f" />
                </svg>
                <b>Carousel</b>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="tile tile-md tile-light">
            <div className="t-eye">Organic & AEO</div>
            <div className="t-ico" style={{ marginTop: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
              </svg>
            </div>
            <h3 className="t-h">Found inside the answer.</h3>
            <p className="t-sub">
              Show up when people ask ChatGPT, Perplexity, Claude and Gemini about your category.
            </p>
          </FadeIn>

          <FadeIn className="tile tile-md tile-fog">
            <div className="t-eye">Channels</div>
            <h3 className="t-h" style={{ marginTop: 14 }}>
              Run them all.
            </h3>
            <div className="chanrail">
              <div className="cr">
                <div className="cr-ic">
                  <svg viewBox="0 0 12 12" fill="none" stroke="#1d1d1f" strokeWidth="1.4">
                    <path d="M2 9l3-3 2 1.5L11 3" />
                  </svg>
                </div>
                <div className="cr-nm">Meta</div>
                <div className="cr-bar">
                  <i style={{ width: '72%' }} />
                </div>
              </div>
              <div className="cr">
                <div className="cr-ic">
                  <svg viewBox="0 0 12 12" fill="none" stroke="#1d1d1f" strokeWidth="1.4">
                    <circle cx="5.5" cy="5.5" r="3.5" />
                    <path d="M10 10l-2-2" />
                  </svg>
                </div>
                <div className="cr-nm">Google</div>
                <div className="cr-bar">
                  <i style={{ width: '90%' }} />
                </div>
              </div>
              <div className="cr">
                <div className="cr-ic">
                  <svg viewBox="0 0 12 12" fill="none" stroke="#1d1d1f" strokeWidth="1.4">
                    <rect x="2" y="2" width="8" height="8" rx="1.5" />
                  </svg>
                </div>
                <div className="cr-nm">LinkedIn</div>
                <div className="cr-bar">
                  <i style={{ width: '48%' }} />
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="tile tile-md tile-dark">
            <div className="t-eye">Intelligence</div>
            <div className="t-ico" style={{ marginTop: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#f5f5f7" strokeWidth="1.6">
                <circle cx="8" cy="12" r="3.5" />
                <circle cx="17" cy="12" r="3.5" />
                <path d="M11.5 12h2" />
              </svg>
            </div>
            <h3 className="t-h">Watch every rival.</h3>
            <p className="t-sub">
              Their spend, creative, messaging and AI visibility — surfaced before they move.
            </p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
