import type { Metadata } from 'next';

import LegalLayout, {
  type LegalDocument,
} from '@/app/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy · Robust',
  description:
    'Learn how Robust collects, uses, stores, and protects information across the Robust advertising intelligence platform, including data received from Meta.',
  alternates: { canonical: '/privacy-policy' },
  robots: { index: true, follow: true },
};

const CONTACT_EMAIL = 'support@robust.ai';

const PRIVACY_DOC: LegalDocument = {
  kind: 'privacy',
  eyebrow: 'Legal · Privacy Policy',
  title: 'Robust Privacy Policy',
  subtitle:
    'How we collect, use, store, share, and protect information when you use the Robust advertising intelligence and campaign management platform.',
  effectiveDate: 'May 12, 2026',
  lastUpdated: 'May 12, 2026',
  intro:
    'Robust is an AI-powered advertising intelligence and campaign management platform designed to help businesses, advertisers, and agencies manage, optimize, automate, and scale Meta advertising operations. This Privacy Policy explains how Robust collects, uses, stores, shares, and protects information when users access or use the Robust platform, website, integrations, and related services. By using Robust, you agree to the practices described in this Privacy Policy.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      id: 'information-we-collect',
      title: 'Information We Collect',
      body: `
#### A. Information You Provide

We may collect information that you voluntarily provide when using the platform, including:

- Name
- Email address
- Business or company information
- Account credentials
- Advertising campaign information
- Uploaded creatives, images, videos, and assets
- Campaign presets and automation settings
- Support requests and communications

#### B. Information Received from Meta

When users connect their Meta account to Robust, we may receive certain information and business asset data that users explicitly authorize through Meta's authentication and permission flow.

Depending on the permissions granted, this may include:

- Public profile information
- Meta user ID
- Name and profile picture
- Facebook Pages managed by the user
- Meta ad account information
- Advertising campaign data
- Campaign analytics and insights
- Ad creatives and metadata
- Product catalog information
- Lead form data submitted through Meta Lead Ads
- Page engagement and content insights
- Business Manager asset information
- Access tokens and authorization metadata

Robust only accesses Meta Platform Data that users explicitly authorize.

#### C. Automatically Collected Information

We may automatically collect certain technical and usage-related information, including:

- Device information
- Browser type
- IP address
- Operating system
- Usage analytics
- Log files
- Session information
- Cookies and tracking technologies
- Performance and diagnostic information
      `,
    },
    {
      id: 'how-we-use-information',
      title: 'How We Use Information',
      body: `
Robust uses collected information to:

- Authenticate and identify users
- Provide advertising analytics dashboards
- Enable campaign creation and management
- Manage Meta advertising assets
- Provide AI-powered optimization insights
- Enable campaign automation workflows
- Retrieve and organize lead generation data
- Support product catalog and dynamic advertising workflows
- Improve platform performance and reliability
- Monitor security and prevent abuse
- Provide customer support
- Comply with legal obligations
- Conduct aggregated and anonymized analytics

**We do not sell personal data or Meta Platform Data.**
      `,
    },
    {
      id: 'meta-platform-data-usage',
      title: 'Meta Platform Data Usage',
      body: `
Robust accesses Meta Platform Data only for approved business advertising and campaign management workflows.

Meta Platform Data is used solely to:

- Manage authorized advertising campaigns
- Display analytics and reporting dashboards
- Support automation workflows
- Manage authorized Pages and business assets
- Retrieve lead generation data for authorized advertisers
- Provide AI-driven optimization insights
- Support catalog and commerce advertising workflows

Robust does **not**:

- Sell Meta Platform Data
- Access unauthorized accounts or Pages
- Use Meta data for surveillance or unauthorized profiling
- Share Meta data with unauthorized third parties

Users may revoke permissions through their Meta account settings at any time. Robust complies with Meta Platform Terms and Developer Policies.
      `,
    },
    {
      id: 'sharing-of-information',
      title: 'Sharing of Information',
      body: `
We may share information with trusted service providers and infrastructure partners that help us operate the platform.

These providers may include:

- Cloud hosting providers
- Database hosting providers
- Security and CDN providers
- Analytics providers
- Infrastructure and monitoring providers

Examples may include:

- Amazon Web Services (AWS)
- Cloudflare
- MongoDB Atlas
- Vercel

These providers process information solely to provide services on our behalf and are not authorized to use the data for their own purposes.

We may also disclose information:

- When required by law
- To protect platform security
- To enforce our terms and policies
- In connection with mergers, acquisitions, or business transfers
      `,
    },
    {
      id: 'data-retention',
      title: 'Data Retention',
      body: `
We retain information only for as long as necessary to:

- Provide the Robust platform and services
- Maintain platform security and integrity
- Comply with legal obligations
- Resolve disputes and enforce agreements

Users may request deletion of their data at any time.
      `,
    },
    {
      id: 'data-security',
      title: 'Data Security',
      body: `
Robust implements reasonable technical and organizational safeguards designed to protect user information and Meta Platform Data.

Security measures may include:

- HTTPS/TLS encryption
- Access controls
- Authentication protections
- Secure API communication
- Infrastructure monitoring
- Token protection measures
- Logging and security monitoring

However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.
      `,
    },
    {
      id: 'user-rights-and-choices',
      title: 'User Rights and Choices',
      body: `
Depending on applicable law, users may have rights to:

- Access their information
- Correct inaccurate information
- Request deletion of information
- Revoke Meta permissions
- Restrict or object to certain processing
- Request information portability

Users can disconnect Meta integrations through their Meta account settings.
      `,
    },
    {
      id: 'data-deletion-instructions',
      title: 'Data Deletion Instructions',
      body: `
Users may request deletion of their account and associated data by contacting:

**Email:** [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})

Upon verification of the request, we will process deletion requests within a reasonable timeframe, subject to legal or security retention requirements.

Users may also revoke Robust's access through Meta Business Integrations settings.
      `,
    },
    {
      id: 'cookies-and-tracking',
      title: 'Cookies and Tracking Technologies',
      body: `
Robust may use cookies and similar technologies for:

- Authentication
- Session management
- Platform functionality
- Analytics and performance monitoring
- Security purposes

Users may control cookies through browser settings.
      `,
    },
    {
      id: 'childrens-privacy',
      title: "Children's Privacy",
      body: `
Robust is not intended for children under the age of 13 or the minimum legal age required in the applicable jurisdiction.

We do not knowingly collect personal information from children.
      `,
    },
    {
      id: 'international-data-transfers',
      title: 'International Data Transfers',
      body: `
Information may be processed and stored in countries other than the user's country of residence.

By using the platform, users consent to such transfers where permitted by law.
      `,
    },
    {
      id: 'changes-to-this-policy',
      title: 'Changes to This Privacy Policy',
      body: `
We may update this Privacy Policy from time to time.

Updated versions will be posted on this page with a revised "Last Updated" date.

Continued use of the platform after updates constitutes acceptance of the updated policy.
      `,
    },
    {
      id: 'contact-information',
      title: 'Contact Information',
      body: `
For questions regarding this Privacy Policy or data handling practices, contact:

**Robust**

Email: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})
      `,
    },
  ],
};

export default function PrivacyPolicyPage() {
  return <LegalLayout doc={PRIVACY_DOC} />;
}
