'use client';

import {
  SiGoogle,
  SiHubspot,
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
import type { ReactNode } from 'react';

import { FadeIn } from '../FadeIn';

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="#0A66C2" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type IntegrationItem =
  | { kind: 'si'; Icon: IconType; name: string; color: string }
  | { kind: 'custom'; node: ReactNode; name: string }
  | { kind: 'more'; label: string };

const INTEGRATIONS: IntegrationItem[] = [
  { kind: 'si', Icon: SiMeta,        name: 'Meta',        color: '#0082FB' },
  { kind: 'si', Icon: SiGoogle,      name: 'Google',      color: '#4285F4' },
  { kind: 'custom', node: <LinkedInIcon />, name: 'LinkedIn' },
  { kind: 'si', Icon: SiTiktok,      name: 'TikTok',      color: '#010101' },
  { kind: 'si', Icon: SiYoutube,     name: 'YouTube',     color: '#FF0000' },
  { kind: 'si', Icon: SiShopify,     name: 'Shopify',     color: '#96BF48' },
  { kind: 'si', Icon: SiWoocommerce, name: 'WooCommerce', color: '#7F54B3' },
  { kind: 'si', Icon: SiHubspot,     name: 'HubSpot',     color: '#FF7A59' },
  { kind: 'si', Icon: SiSalesforce,  name: 'Salesforce',  color: '#00A1E0' },
  { kind: 'si', Icon: SiReddit,      name: 'Reddit',      color: '#FF4500' },
  { kind: 'si', Icon: SiMailchimp,   name: 'Mailchimp',   color: '#FFE01B' },
  { kind: 'more', label: '40 more' },
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
          {INTEGRATIONS.map((item) => {
            if (item.kind === 'more') {
              return (
                <FadeIn key="more" className="intcell">
                  <div
                    className="ig"
                    style={{ background: 'transparent', fontSize: 22, color: 'var(--ink)' }}
                  >
                    +
                  </div>
                  <span>{item.label}</span>
                </FadeIn>
              );
            }
            if (item.kind === 'custom') {
              return (
                <FadeIn key={item.name} className="intcell">
                  <div className="ig" style={{ background: 'transparent' }}>
                    {item.node}
                  </div>
                  <span>{item.name}</span>
                </FadeIn>
              );
            }
            const { Icon, name, color } = item;
            return (
              <FadeIn key={name} className="intcell">
                <div className="ig" style={{ background: 'transparent' }}>
                  <Icon style={{ color, width: 26, height: 26 }} />
                </div>
                <span>{name}</span>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
