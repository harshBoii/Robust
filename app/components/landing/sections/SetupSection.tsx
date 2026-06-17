import { FadeIn } from '../FadeIn';

export function SetupSection() {
  return (
    <section className="sec" id="setup" style={{ background: 'var(--fog)' }}>
      <div className="shell">
        <FadeIn className="kicker">Setup</FadeIn>
        <FadeIn>
          <h2 className="title">Running in fifteen minutes.</h2>
        </FadeIn>
        <FadeIn>
          <p className="deck">
            No engineers. No onboarding calls. Three steps, and the whole system is live.
          </p>
        </FadeIn>
        <div className="steps">
          <FadeIn className="step">
            <div className="step-n">1</div>
            <div>
              <div className="step-h">Teach it your brand.</div>
              <p className="step-p">
                Voice, products, audience, rivals, ambitions — captured once. Every part of the
                system reasons from the same understanding.
              </p>
            </div>
            <div className="step-art">
              <div className="ringwrap">
                <svg className="ring" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="33" fill="none" stroke="#e3e3e8" strokeWidth="8" />
                  <circle
                    cx="40"
                    cy="40"
                    r="33"
                    fill="none"
                    stroke="#1d1d1f"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="207"
                    strokeDashoffset="42"
                    transform="rotate(-90 40 40)"
                  />
                  <text
                    x="40"
                    y="38"
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="600"
                    fill="#1d1d1f"
                    fontFamily="sans-serif"
                  >
                    80
                  </text>
                  <text
                    x="40"
                    y="52"
                    textAnchor="middle"
                    fontSize="9"
                    fill="#86868b"
                    fontFamily="sans-serif"
                  >
                    percent
                  </text>
                </svg>
                <div className="ring-legend">
                  <div className="rl">
                    <i style={{ background: '#1d1d1f' }} />
                    Brand & voice<b>Done</b>
                  </div>
                  <div className="rl">
                    <i style={{ background: '#1d1d1f' }} />
                    Products<b>Done</b>
                  </div>
                  <div className="rl">
                    <i style={{ background: '#0071e3' }} />
                    Rivals<b>65%</b>
                  </div>
                  <div className="rl-hint">Add rivals to unlock competitive intelligence</div>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="step">
            <div className="step-n">2</div>
            <div>
              <div className="step-h">Connect your accounts.</div>
              <p className="step-p">
                Link your platforms, store, and CRM. Robust reads the history and builds a working
                baseline on its own.
              </p>
            </div>
            <div className="step-art">
              <div className="conn">
                <div className="conn-row">
                  <div className="conn-ic">M</div>
                  <div className="conn-nm">Meta Ads</div>
                  <div className="conn-st ok">
                    <svg viewBox="0 0 13 13" fill="none" stroke="#1c8c4e" strokeWidth="1.8">
                      <path d="M2 7l3 3 6-7" />
                    </svg>
                    Connected
                  </div>
                </div>
                <div className="conn-row">
                  <div className="conn-ic">G</div>
                  <div className="conn-nm">Google Ads</div>
                  <div className="conn-st ok">
                    <svg viewBox="0 0 13 13" fill="none" stroke="#1c8c4e" strokeWidth="1.8">
                      <path d="M2 7l3 3 6-7" />
                    </svg>
                    Connected
                  </div>
                </div>
                <div className="conn-row">
                  <div className="conn-ic">in</div>
                  <div className="conn-nm">LinkedIn</div>
                  <div className="conn-st ok">
                    <svg viewBox="0 0 13 13" fill="none" stroke="#1c8c4e" strokeWidth="1.8">
                      <path d="M2 7l3 3 6-7" />
                    </svg>
                    Connected
                  </div>
                </div>
                <div className="conn-row">
                  <div className="conn-ic">S</div>
                  <div className="conn-nm">Shopify</div>
                  <div className="conn-st">
                    <span className="spinner" />
                    Reading history
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="step">
            <div className="step-n">3</div>
            <div>
              <div className="step-h">Decide how much it runs.</div>
              <p className="step-p">
                Full autonomy, your sign-off, or a mix per surface. Change your mind at any moment —
                you stay in command.
              </p>
            </div>
            <div className="step-art">
              <div className="ctrl">
                <div className="ctrl-row">
                  <span className="ctrl-nm">Paid campaigns</span>
                  <div className="ctrl-r">
                    <span className="ctrl-tag">Autonomous</span>
                    <div className="sw on">
                      <i />
                    </div>
                  </div>
                </div>
                <div className="ctrl-row">
                  <span className="ctrl-nm">Content & email</span>
                  <div className="ctrl-r">
                    <span className="ctrl-tag">Review first</span>
                    <div className="sw off">
                      <i />
                    </div>
                  </div>
                </div>
                <div className="ctrl-row">
                  <span className="ctrl-nm">Budget shifts</span>
                  <div className="ctrl-r">
                    <span className="ctrl-tag">Autonomous</span>
                    <div className="sw on">
                      <i />
                    </div>
                  </div>
                </div>
                <div className="ctrl-row">
                  <span className="ctrl-nm">Social posts</span>
                  <div className="ctrl-r">
                    <span className="ctrl-tag">Review first</span>
                    <div className="sw off">
                      <i />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
        <FadeIn className="tl-bar">
          <div className="tl-cell">
            <div className="tl-cv">5 min</div>
            <div className="tl-cl">Brand</div>
          </div>
          <div className="tl-cell">
            <div className="tl-cv">5 min</div>
            <div className="tl-cl">Connect</div>
          </div>
          <div className="tl-cell">
            <div className="tl-cv">2 min</div>
            <div className="tl-cl">Controls</div>
          </div>
          <div className="tl-cell">
            <div className="tl-cv">Live</div>
            <div className="tl-cl">Everything running</div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
