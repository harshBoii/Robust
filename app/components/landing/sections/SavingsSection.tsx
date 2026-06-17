import { FadeIn } from '../FadeIn';

const SAVINGS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    ),
    title: 'No dead spend',
    body: 'Sets with no conversions are caught and paused before the budget burns.',
    num: '$975',
    suffix: ' recovered each month',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
      </svg>
    ),
    title: 'No creative bill',
    body: 'Unlimited ads, films and carousels at no added cost per asset.',
    num: '$18,000',
    suffix: ' saved each month',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <path d="M3 17l5-5 4 3 8-9" />
      </svg>
    ),
    title: 'Smarter budget',
    body: 'Money flows to whatever is working, recalculated in real time.',
    num: '40%',
    suffix: ' average lift in return',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <path d="M4 5h16v11H4z" />
        <path d="M4 9h16" />
      </svg>
    ),
    title: 'No content team gap',
    body: 'Always-on publishing across every owned channel, in your voice.',
    num: '8–10 hrs',
    suffix: ' back every week',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
      </svg>
    ),
    title: 'Free AI-search traffic',
    body: 'Recommended inside the answer engines, with no media behind it.',
    num: 'No SEO retainer',
    suffix: ' required',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.6">
        <circle cx="8" cy="12" r="3.5" />
        <circle cx="17" cy="12" r="3.5" />
      </svg>
    ),
    title: 'No research agency',
    body: 'Competitive tracking that would cost a retainer, built right in.',
    num: 'Always-on',
    suffix: ' rival monitoring',
  },
] as const;

export function SavingsSection() {
  return (
    <section className="sec">
      <div className="shell">
        <FadeIn className="kicker">Worth it from week one</FadeIn>
        <FadeIn>
          <h2 className="title">It pays for itself, everywhere.</h2>
        </FadeIn>
        <div className="savgrid">
          {SAVINGS.map((s) => (
            <FadeIn key={s.title} className="sav">
              <div className="sav-ic">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="sav-num">
                {s.num}
                <span>{s.suffix}</span>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
