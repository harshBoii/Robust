import { FadeIn } from '../FadeIn';

export function IntelligenceSection() {
  return (
    <section className="sec" id="intelligence" style={{ background: 'var(--fog)' }}>
      <div className="shell">
        <FadeIn className="kicker">Always a step ahead</FadeIn>
        <FadeIn>
          <h2 className="title">Know the field before it shifts.</h2>
        </FadeIn>
        <div className="split">
          <FadeIn className="block">
            <div className="block-h">
              <h3>Competitive intelligence</h3>
              <p>Spend, creative, messaging and AI visibility — watched continuously.</p>
            </div>
            <div className="rivgrid">
              <div className="rcell">
                <div className="rcell-l">Rival A · spend</div>
                <div className="rcell-v">
                  $42K<span>/mo</span>
                </div>
                <div className="rcell-s">34 creatives, mostly video</div>
                <div className="rcell-tag">Weak in AI search — your opening</div>
              </div>
              <div className="rcell">
                <div className="rcell-l">Rival B · cadence</div>
                <div className="rcell-v">
                  3×<span>/wk</span>
                </div>
                <div className="rcell-s">LinkedIn only, no newsletter</div>
                <div className="rcell-tag pos">You publish four — you lead</div>
              </div>
            </div>
            <div className="rivlog">
              <div className="rlog">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <path d="M3 17l5-5 4 3 8-9" />
                </svg>
                <p>Rival A moved budget into TikTok this week.</p>
                <span className="b-new">New</span>
              </div>
              <div className="rlog">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                </svg>
                <p>You now lead Rival B by 14 points in AI search.</p>
                <span className="b-new" style={{ color: '#1c8c4e', background: 'rgba(28,140,78,.1)' }}>
                  Leading
                </span>
              </div>
              <div className="rlog">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
                  <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
                </svg>
                <p>Six new rival films detected — counter set proposed.</p>
                <span className="b-new">Action</span>
              </div>
            </div>
          </FadeIn>

          <FadeIn className="block">
            <div className="block-h">
              <h3>Built for how you grow</h3>
              <p>D2C, SaaS, or consumer — the same system, tuned to your model.</p>
            </div>
            <div className="usecases">
              <div className="uc">
                <div className="uc-top">
                  <div className="uc-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <path d="M6 8h12l-1 12H7z" />
                      <path d="M9 8a3 3 0 016 0" />
                    </svg>
                  </div>
                  <div className="uc-name">Direct-to-consumer</div>
                </div>
                <div className="uc-metrics">
                  <div>
                    <div className="ucm-v">5.4×</div>
                    <div className="ucm-l">ROAS</div>
                  </div>
                  <div>
                    <div className="ucm-v">240+</div>
                    <div className="ucm-l">Creatives / mo</div>
                  </div>
                  <div>
                    <div className="ucm-v">$25K</div>
                    <div className="ucm-l">Saved / mo</div>
                  </div>
                </div>
              </div>
              <div className="uc">
                <div className="uc-top">
                  <div className="uc-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <rect x="3" y="5" width="18" height="13" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                  </div>
                  <div className="uc-name">SaaS</div>
                </div>
                <div className="uc-metrics">
                  <div>
                    <div className="ucm-v">$3.80</div>
                    <div className="ucm-l">Cost / lead</div>
                  </div>
                  <div>
                    <div className="ucm-v">74%</div>
                    <div className="ucm-l">AI visibility</div>
                  </div>
                  <div>
                    <div className="ucm-v">3.2×</div>
                    <div className="ucm-l">More MQLs</div>
                  </div>
                </div>
              </div>
              <div className="uc">
                <div className="uc-top">
                  <div className="uc-ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.5">
                      <rect x="6" y="3" width="12" height="18" rx="2.5" />
                      <path d="M11 18h2" />
                    </svg>
                  </div>
                  <div className="uc-name">Consumer app</div>
                </div>
                <div className="uc-metrics">
                  <div>
                    <div className="ucm-v">$0.51</div>
                    <div className="ucm-l">Cost / install</div>
                  </div>
                  <div>
                    <div className="ucm-v">1,240</div>
                    <div className="ucm-l">Installs / day</div>
                  </div>
                  <div>
                    <div className="ucm-v">8+</div>
                    <div className="ucm-l">Channels</div>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
