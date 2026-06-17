import { FadeIn } from '../FadeIn';

const INTEGRATIONS = [
  { icon: 'M', name: 'Meta' },
  { icon: 'G', name: 'Google' },
  { icon: 'in', name: 'LinkedIn' },
  { icon: 'T', name: 'TikTok' },
  { icon: '▶', name: 'YouTube' },
  { icon: 'S', name: 'Shopify' },
  { icon: 'W', name: 'WooCommerce' },
  { icon: 'H', name: 'HubSpot' },
  { icon: 'SF', name: 'Salesforce' },
  { icon: 'R', name: 'Reddit' },
  { icon: '@', name: 'Mailchimp' },
  { icon: '+', name: '40 more' },
] as const;

export function IntegrationsSection() {
  return (
    <section className="sec" style={{ padding: '90px 0' }}>
      <div className="shell">
        <FadeIn className="kicker">Works with what you have</FadeIn>
        <FadeIn>
          <h2 className="title">It fits your stack.</h2>
        </FadeIn>
        <div className="intgrid">
          {INTEGRATIONS.map((item) => (
            <FadeIn key={item.name} className="intcell">
              <div className="ig">{item.icon}</div>
              <span>{item.name}</span>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
