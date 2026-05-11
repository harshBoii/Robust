import type { Metadata } from 'next';

import LegalLayout, {
  type LegalDocument,
} from '@/app/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service · Robust',
  description:
    'The Terms of Service that govern access to and use of the Robust advertising intelligence platform, APIs, and Meta integrations.',
  alternates: { canonical: '/terms-and-conditions' },
  robots: { index: true, follow: true },
};

const CONTACT_EMAIL = 'support@robust.ai';

const TERMS_DOC: LegalDocument = {
  kind: 'terms',
  eyebrow: 'Legal · Terms of Service',
  title: 'Robust Terms of Service',
  subtitle:
    'These Terms govern access to and use of the Robust platform, website, APIs, integrations, and related services. By accessing or using Robust, you agree to these Terms.',
  effectiveDate: 'May 12, 2026',
  lastUpdated: 'May 12, 2026',
  intro:
    'These Terms of Service ("Terms") govern access to and use of the Robust platform, website, APIs, integrations, and related services. By accessing or using Robust, you agree to these Terms. If you do not agree to these Terms, do not use the platform.',
  contactEmail: CONTACT_EMAIL,
  sections: [
    {
      id: 'description-of-service',
      title: 'Description of Service',
      body: `
Robust is an AI-powered advertising intelligence and campaign management platform that provides:

- Advertising analytics dashboards
- Campaign management workflows
- Automation and optimization tools
- AI-generated advertising insights
- Bulk creative management
- Meta advertising integrations
- Lead management workflows
- Catalog and commerce advertising support

Certain features rely on integrations with third-party services, including Meta Platforms.
      `,
    },
    {
      id: 'eligibility',
      title: 'Eligibility',
      body: `
You represent that:

- You are legally permitted to use the platform
- You are authorized to connect and manage any advertising accounts or business assets linked to Robust
- Your use complies with applicable laws and Meta policies
      `,
    },
    {
      id: 'user-accounts',
      title: 'User Accounts',
      body: `
Users are responsible for:

- Maintaining account security
- Protecting credentials and access tokens
- All activity occurring under their account
- Ensuring connected Meta assets are properly authorized

Users must promptly notify Robust of unauthorized access or security incidents.
      `,
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable Use',
      body: `
Users agree **not** to:

- Violate applicable laws or regulations
- Engage in fraudulent or deceptive advertising
- Access unauthorized accounts or data
- Abuse APIs or platform infrastructure
- Upload malicious software or harmful content
- Interfere with platform security or operation
- Infringe intellectual property rights
- Use the platform for spam or unlawful marketing
      `,
    },
    {
      id: 'meta-platform-compliance',
      title: 'Meta Platform Compliance',
      body: `
Use of Meta-integrated functionality is subject to Meta's Platform Terms, Developer Policies, and advertising policies.

Users may only connect Pages, ad accounts, catalogs, and business assets they are authorized to manage.

Robust may limit or terminate integrations if required by Meta or applicable law.
      `,
    },
    {
      id: 'advertising-and-ai-features',
      title: 'Advertising and AI Features',
      body: `
Robust provides AI-powered insights and automation features intended to assist users in advertising operations.

AI-generated recommendations are informational only.

Users remain solely responsible for:

- Advertising decisions
- Campaign compliance
- Budget allocation
- Creative content
- Legal compliance
- Performance outcomes

Robust does not guarantee advertising performance, conversion rates, or business outcomes.
      `,
    },
    {
      id: 'user-content',
      title: 'User Content',
      body: `
Users retain ownership of content they upload, including:

- Images
- Videos
- Ad creatives
- Campaign materials
- Marketing assets

Users grant Robust a limited license necessary to:

- Store
- Process
- Display
- Analyze
- Deliver

such content solely for operating the platform.

Users represent they have all rights necessary for uploaded content.
      `,
    },
    {
      id: 'intellectual-property',
      title: 'Intellectual Property',
      body: `
The Robust platform, software, branding, interfaces, AI systems, and related technology are owned by Robust and protected by applicable intellectual property laws.

Users may **not**:

- Copy
- Reverse engineer
- Modify
- Redistribute
- Resell

platform technology without authorization.
      `,
    },
    {
      id: 'service-availability',
      title: 'Service Availability',
      body: `
Robust may modify, suspend, or discontinue features at any time.

The platform depends on third-party services, including Meta APIs, which may change, restrict, or interrupt functionality.

We do not guarantee uninterrupted availability.
      `,
    },
    {
      id: 'privacy',
      title: 'Privacy',
      body: `
Use of the platform is also governed by the [Robust Privacy Policy](/privacy-policy).
      `,
    },
    {
      id: 'limitation-of-liability',
      title: 'Limitation of Liability',
      body: `
To the maximum extent permitted by law, Robust and its operators shall not be liable for:

- Advertising losses
- Campaign performance issues
- Business interruption
- Data loss
- API downtime
- Third-party service failures
- Indirect, incidental, special, or consequential damages

Users assume all risks associated with advertising activities and campaign management.
      `,
    },
    {
      id: 'disclaimer-of-warranties',
      title: 'Disclaimer of Warranties',
      body: `
The platform is provided on an "as is" and "as available" basis.

Robust disclaims all warranties, express or implied, including warranties of:

- Merchantability
- Fitness for a particular purpose
- Non-infringement
- Availability
- Accuracy
      `,
    },
    {
      id: 'indemnification',
      title: 'Indemnification',
      body: `
Users agree to indemnify and hold harmless Robust and its operators from claims, damages, liabilities, costs, and expenses arising from:

- User content
- Advertising activities
- Violation of laws or policies
- Misuse of the platform
- Violation of these Terms
      `,
    },
    {
      id: 'termination',
      title: 'Termination',
      body: `
Robust may suspend or terminate access to the platform for:

- Violations of these Terms
- Security concerns
- Fraudulent activity
- Abuse of integrations or APIs
- Legal or regulatory reasons

Users may stop using the platform at any time.
      `,
    },
    {
      id: 'governing-law',
      title: 'Governing Law',
      body: `
These Terms shall be governed by and construed in accordance with the laws of **India**.
      `,
    },
    {
      id: 'dispute-resolution',
      title: 'Dispute Resolution',
      body: `
Any disputes arising from these Terms or use of the platform shall be subject to the exclusive jurisdiction of courts located in **India**.
      `,
    },
    {
      id: 'changes-to-these-terms',
      title: 'Changes to These Terms',
      body: `
We may update these Terms from time to time.

Updated versions will be posted with a revised "Last Updated" date.

Continued use of the platform constitutes acceptance of updated Terms.
      `,
    },
    {
      id: 'contact-information',
      title: 'Contact Information',
      body: `
For questions regarding these Terms, contact:

**Robust**

Email: [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})
      `,
    },
  ],
};

export default function TermsAndConditionsPage() {
  return <LegalLayout doc={TERMS_DOC} />;
}
