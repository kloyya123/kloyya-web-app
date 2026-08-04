/**
 * Privacy Policy and Terms of Service, verbatim.
 *
 * Legal copy, kept structured (not one HTML blob) so both documents render
 * through the same component and share the same look as the rest of the
 * marketing site. The text itself is not this file's to edit casually — it
 * came from whoever owns Kloyya's legal review, and any change belongs there
 * first.
 */

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'h3'; text: string };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
}

const p = (text: string): LegalBlock => ({ type: 'p', text });
const list = (items: string[]): LegalBlock => ({ type: 'list', items });
const h3 = (text: string): LegalBlock => ({ type: 'h3', text });

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Kloyya Privacy Policy',
  effectiveDate: 'August 2026',
  intro: [
    'Welcome to Kloyya ("Kloyya," "we," "our," or "us"). We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains what information we collect, how we use it, and the choices you have regarding your data.',
    'By using Kloyya, you agree to this Privacy Policy.',
  ],
  sections: [
    {
      heading: '1. Information We Collect',
      blocks: [
        p('We collect information you provide directly to us, information collected automatically when you use our services, and information from third-party services that you choose to connect.'),
        h3('Account Information'),
        p('When you create an account, we may collect:'),
        list([
          'Name',
          'Email address',
          'Country',
          'Occupation or role',
          'Profile information',
          'Authentication credentials (managed through Supabase Authentication)',
        ]),
        h3('Connected Services'),
        p('If you connect third-party services, we may access information that you explicitly authorize.'),
        p('Examples include:'),
        list([
          'Gmail',
          'Google Calendar',
          'Google Drive',
          'Microsoft Outlook',
          'OneDrive',
          'Notion',
          'Slack (if connected)',
          'GitHub (if connected)',
        ]),
        p('We only access data necessary to provide requested features.'),
        h3('Uploaded Content'),
        p('You may upload:'),
        list(['Documents', 'PDFs', 'Images', 'Presentations', 'Spreadsheets', 'Notes']),
        h3('Usage Information'),
        p('We automatically collect:'),
        list([
          'Device information',
          'Browser information',
          'IP address',
          'Log files',
          'Feature usage',
          'Performance metrics',
          'Error reports',
        ]),
        h3('Analytics'),
        p('We use PostHog to understand product usage and improve Kloyya.'),
      ],
    },
    {
      heading: '2. How We Use Information',
      blocks: [
        p('We use your information to:'),
        list([
          'Provide Kloyya services',
          'Authenticate users',
          'Generate AI responses',
          'Build workspace context',
          'Create daily briefings',
          'Improve search results',
          'Improve recommendations',
          'Improve product performance',
          'Detect fraud',
          'Maintain security',
          'Respond to support requests',
          'Send service-related emails',
        ]),
      ],
    },
    {
      heading: '3. AI Processing',
      blocks: [
        p('Kloyya uses AI models to help generate summaries, recommendations, insights, and answers.'),
        p('We do not train our own foundation models using your private workspace data.'),
        p('Your connected data is processed to answer your requests and improve your experience within your own workspace.'),
      ],
    },
    {
      heading: '4. Connected Accounts',
      blocks: [
        p('You control which services you connect.'),
        p('You may disconnect any service at any time.'),
        p('Disconnecting a service stops future synchronization.'),
      ],
    },
    {
      heading: '5. Data Storage',
      blocks: [
        p('We use:'),
        list(['Supabase Authentication', 'Supabase PostgreSQL', 'Supabase Storage', 'pgvector', 'Vercel', 'Resend', 'PostHog']),
        p('Your data may be processed in multiple regions depending on our infrastructure providers.'),
      ],
    },
    {
      heading: '6. Data Security',
      blocks: [
        p('We use industry-standard security measures including:'),
        list([
          'Encryption in transit',
          'Encryption at rest',
          'Secure authentication',
          'Role-Based Access Control',
          'Row Level Security',
          'Audit logging',
          'Rate limiting',
        ]),
        p('No security system is completely secure, but we continuously improve our safeguards.'),
      ],
    },
    {
      heading: '7. Data Retention',
      blocks: [
        p('We retain information only as long as necessary to:'),
        list(['Provide services', 'Meet legal obligations', 'Resolve disputes', 'Enforce agreements']),
        p('You may request deletion of your account.'),
      ],
    },
    {
      heading: '8. Your Rights',
      blocks: [
        p('Depending on your location, you may have the right to:'),
        list([
          'Access your data',
          'Correct your information',
          'Delete your account',
          'Export your information',
          'Disconnect integrations',
          'Withdraw consent where applicable',
        ]),
      ],
    },
    {
      heading: '9. Cookies',
      blocks: [
        p('Kloyya uses cookies and similar technologies to:'),
        list(['Keep you signed in', 'Improve security', 'Remember preferences', 'Measure product performance']),
      ],
    },
    {
      heading: '10. Children’s Privacy',
      blocks: [
        p('Kloyya is not intended for children under 13 years of age (or the applicable minimum age in your jurisdiction).'),
      ],
    },
    {
      heading: '11. Third-Party Services',
      blocks: [
        p('Kloyya integrates with third-party providers.'),
        p('Their use of your information is governed by their own privacy policies.'),
      ],
    },
    {
      heading: '12. International Users',
      blocks: [
        p('By using Kloyya, you understand that your information may be transferred and processed in countries outside your own.'),
      ],
    },
    {
      heading: '13. Changes',
      blocks: [
        p('We may update this Privacy Policy.'),
        p('If material changes are made, we will notify users through the application or by email.'),
      ],
    },
    {
      heading: '14. Contact',
      blocks: [p('Email: contactsupport@kloyya.com')],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  title: 'Kloyya Terms of Service',
  effectiveDate: 'August 2026',
  intro: [
    'These Terms govern your access to and use of Kloyya.',
    'By creating an account or using our services, you agree to these Terms.',
  ],
  sections: [
    {
      heading: '1. About Kloyya',
      blocks: [
        p('Kloyya is an AI Chief of Staff that helps users organize work, retrieve knowledge, connect productivity tools, and make informed decisions.'),
      ],
    },
    {
      heading: '2. Eligibility',
      blocks: [
        p('You must:'),
        list(['Be legally capable of entering into contracts.', 'Provide accurate information.', 'Keep your account secure.']),
      ],
    },
    {
      heading: '3. Your Account',
      blocks: [
        p('You are responsible for:'),
        list(['Maintaining account security', 'Keeping credentials confidential', 'All activity under your account']),
      ],
    },
    {
      heading: '4. Connected Services',
      blocks: [
        p('Kloyya allows users to connect third-party services.'),
        p('You authorize Kloyya to access only the data necessary to provide requested functionality.'),
        p('You remain responsible for complying with the terms of those third-party services.'),
      ],
    },
    {
      heading: '5. Acceptable Use',
      blocks: [
        p('You agree not to:'),
        list([
          'Break the law',
          'Abuse the platform',
          'Upload malicious software',
          'Attempt unauthorized access',
          'Interfere with service availability',
          'Reverse engineer Kloyya',
          'Use the service to violate intellectual property rights',
          'Circumvent security controls',
        ]),
      ],
    },
    {
      heading: '6. AI Responses',
      blocks: [
        p('AI-generated responses:'),
        list(['May contain errors', 'Should be reviewed before making important decisions', 'Are provided for informational purposes']),
        p('You remain responsible for your decisions.'),
      ],
    },
    {
      heading: '7. User Content',
      blocks: [
        p('You retain ownership of your content.'),
        p('You grant Kloyya a limited license to process your content solely for providing the services.'),
        p('We do not claim ownership of your files or documents.'),
      ],
    },
    {
      heading: '8. Intellectual Property',
      blocks: [
        p('Kloyya, its software, branding, logos, designs, and technology remain our intellectual property.'),
        p('You may not copy, modify, distribute, or reproduce them without permission.'),
      ],
    },
    {
      heading: '9. Subscription Plans',
      blocks: [
        p('Certain features require a paid subscription.'),
        p('Subscription terms, pricing, and billing are displayed before purchase.'),
        p('Failure to pay may result in loss of premium features.'),
      ],
    },
    {
      heading: '10. Beta Features',
      blocks: [
        p('Some features may be released as beta.'),
        p('Beta features:'),
        list(['May change', 'May contain bugs', 'May be discontinued without notice']),
      ],
    },
    {
      heading: '11. Availability',
      blocks: [
        p('We strive for reliable service but do not guarantee uninterrupted availability.'),
        p('Maintenance, outages, or third-party failures may temporarily affect access.'),
      ],
    },
    {
      heading: '12. Suspension',
      blocks: [
        p('We may suspend or terminate accounts that:'),
        list(['Violate these Terms', 'Abuse the platform', 'Threaten security', 'Engage in fraudulent activity']),
      ],
    },
    {
      heading: '13. Disclaimer',
      blocks: [
        p('Kloyya is provided "as is" and "as available."'),
        p('We make no guarantees that:'),
        list(['AI outputs are always accurate', 'Services will be uninterrupted', 'Every feature will remain available']),
      ],
    },
    {
      heading: '14. Limitation of Liability',
      blocks: [
        p('To the fullest extent permitted by law, Kloyya and its affiliates shall not be liable for indirect, incidental, consequential, special, or punitive damages arising from your use of the service.'),
        p('Where liability cannot be excluded by law, our total liability will be limited to the amount you paid to Kloyya in the twelve months preceding the claim.'),
      ],
    },
    {
      heading: '15. Indemnification',
      blocks: [
        p('You agree to indemnify and hold Kloyya harmless against claims arising from:'),
        list([
          'Your misuse of the service',
          'Your violation of these Terms',
          'Your violation of applicable laws',
          'Your infringement of third-party rights',
        ]),
      ],
    },
    {
      heading: '16. Governing Law',
      blocks: [
        p('These Terms are governed by the laws specified in your business’s governing jurisdiction, without regard to conflict of law principles.'),
      ],
    },
    {
      heading: '17. Changes',
      blocks: [
        p('We may update these Terms from time to time.'),
        p('Continued use of Kloyya constitutes acceptance of the updated Terms.'),
      ],
    },
    {
      heading: '18. Contact',
      blocks: [
        h3('General Support'),
        p('contactsupport@kloyya.com'),
        h3('Privacy'),
        p('contactsupport@kloyya.com'),
        h3('Legal'),
        p('contactsupport@kloyya.com'),
      ],
    },
  ],
};
