import {
  SiGoogle,
  SiHubspot,
  SiLinkedin,
  SiMailchimp,
  SiMeta,
  SiReddit,
  SiSalesforce,
  SiShopify,
  SiTiktok,
  SiWoocommerce,
  SiYoutube,
} from 'react-icons/si';
import type { IconType } from 'react-icons';

import { FadeIn } from '../FadeIn';

const INTEGRATIONS: { Icon: IconType; name: string; color: string }[] = [
  { Icon: SiMeta,         name: 'Meta',         color: '#0082FB' },
  { Icon: SiGoogle,       name: 'Google',       color: '#4285F4' },
  { Icon: SiLinkedin,     name: 'LinkedIn',     color: '#0A66C2' },
  { Icon: SiTiktok,       name: 'TikTok',       color: '#000000' },
  { Icon: SiYoutube,      name: 'YouTube',      color: '#FF0000' },
  { Icon: SiShopify,      name: 'Shopify',      color: '#96BF48' },
  { Icon: SiWoocommerce,  name: 'WooCommerce',  color: '#7F54B3' },
  { Icon: SiHubspot,      name: 'HubSpot',      color: '#FF7A59' },
  { Icon: SiSalesforce,   name: 'Salesforce',   color: '#00A1E0' },
  { Icon: SiReddit,       name: 'Reddit',       color: '#FF4500' },
  { Icon: SiMailchimp,    name: 'Mailchimp',    color: '#FFE01B' },
];

export function IntegrationsSection() {
  return (
    <section className="sec" style={{ padding: '90px 0' }}>
      <div className="shell">
        <FadeIn className="kicker">Works with what you have</FadeIn>
        <FadeIn>
          <h2 className="title">It fits your stack.</h2>
        </FadeIn>
        <div className="intgrid">
          {INTEGRATIONS.map(({ Icon, name, color }) => (
            <FadeIn key={name} className="intcell">
              <div className="ig" style={{ background: 'transparent' }}>
                <Icon style={{ color, width: 26, height: 26 }} />
              </div>
              <span>{name}</span>
            </FadeIn>
          ))}
          <FadeIn className="intcell">
            <div className="ig" style={{ background: 'transparent', fontSize: 22, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </div>
            <span>40 more</span>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
