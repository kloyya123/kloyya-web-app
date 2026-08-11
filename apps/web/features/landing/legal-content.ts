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
  | { type: 'h3'; text: string }
  | { type: 'email'; address: string };

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
const email = (address: string): LegalBlock => ({ type: 'email', address });

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
      blocks: [email('contactsupport@kloyya.com')],
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
        email('contactsupport@kloyya.com'),
        h3('Privacy'),
        email('contactsupport@kloyya.com'),
        h3('Legal'),
        email('contactsupport@kloyya.com'),
      ],
    },
  ],
};

export const TRUST_CENTER: LegalDoc = {
  title: 'Kloyya Trust Center',
  effectiveDate: 'August 2026',
  intro: [
    'At Kloyya, trust is the foundation of everything we build.',
    'Our mission is to help individuals and organizations work more effectively with AI while ensuring their information remains secure, private, and under their control.',
    'This Trust Center explains how we protect your data, build AI responsibly, and maintain the reliability of our platform.',
  ],
  sections: [
    {
      heading: 'Security',
      blocks: [
        p('We use modern security practices designed to protect customer data and maintain the integrity of our platform.'),
        p('Our security measures include:'),
        list([
          'Encryption in transit using HTTPS/TLS',
          'Encryption at rest through our infrastructure providers',
          'Secure authentication',
          'Row Level Security (RLS)',
          'Secure API authentication',
          'Secure OAuth integrations',
          'Principle of least privilege',
          'Continuous monitoring',
          'Rate limiting',
          'Secure session management',
          'Regular dependency updates',
        ]),
        p('Security is considered throughout the development lifecycle rather than added after features are built.'),
      ],
    },
    {
      heading: 'Privacy',
      blocks: [
        p('Your data belongs to you.'),
        p('We do not sell your personal information or customer data.'),
        p('Kloyya only accesses data that you explicitly authorize through connected services such as Gmail, Calendar, Notion, or other supported integrations.'),
        p('You remain in control of your connected accounts and may disconnect them at any time.'),
      ],
    },
    {
      heading: 'Responsible AI',
      blocks: [
        p('Kloyya is designed to help users make better decisions—not replace human judgment.'),
        p('Our AI may:'),
        list(['Summarize information', 'Generate recommendations', 'Produce daily briefings', 'Retrieve relevant knowledge', 'Organize information']),
        p('AI-generated responses may occasionally be incomplete or incorrect. We encourage users to review important outputs before relying on them for critical decisions.'),
      ],
    },
    {
      heading: 'Data Ownership',
      blocks: [
        p('Everything you upload or connect remains yours.'),
        p('This includes:'),
        list(['Documents', 'Emails', 'Notes', 'Calendar events', 'Connected workspace data']),
        p('Kloyya processes this information only to provide requested services.'),
      ],
    },
    {
      heading: 'Availability',
      blocks: [
        p('We continuously monitor platform health and work to maintain reliable service.'),
        p('Planned maintenance may occasionally require temporary downtime. Significant incidents affecting customer data or platform availability will be communicated as appropriate.'),
      ],
    },
    {
      heading: 'Compliance Journey',
      blocks: [
        p('As Kloyya grows, we intend to align our security and privacy practices with recognized industry standards and applicable regulations. We will publish updates as our compliance program evolves.'),
      ],
    },
    {
      heading: 'Contact',
      blocks: [
        h3('Security questions'),
        email('contactsupport@kloyya.com'),
        h3('Privacy questions'),
        email('contactsupport@kloyya.com'),
      ],
    },
  ],
};

export const COMPLIANCE: LegalDoc = {
  title: 'Kloyya Compliance',
  effectiveDate: 'August 2026',
  intro: [
    'Kloyya is committed to operating responsibly while protecting customer data and respecting applicable privacy and security requirements.',
    'Our compliance program continues to evolve alongside our product.',
  ],
  sections: [
    {
      heading: 'Security by Design',
      blocks: [
        p('Security is integrated into our engineering process from the beginning.'),
        p('We use:'),
        list([
          'Secure authentication',
          'Database Row Level Security',
          'Encrypted communication',
          'Secure cloud infrastructure',
          'Access controls',
          'Audit logging',
          'Secure software development practices',
        ]),
      ],
    },
    {
      heading: 'Data Protection',
      blocks: [
        p('We are committed to protecting customer information through:'),
        list(['Data minimization', 'Encryption', 'Secure storage', 'Authentication controls', 'Permission-based access', 'Customer-controlled integrations']),
      ],
    },
    {
      heading: 'Privacy',
      blocks: [
        p('Our privacy practices are designed to provide transparency regarding:'),
        list(['Information collected', 'Purpose of collection', 'Data retention', 'Customer rights', 'Third-party services']),
        p('Please review our Privacy Policy for complete details.'),
      ],
    },
    {
      heading: 'Responsible AI',
      blocks: [
        p('Kloyya is designed to assist users rather than replace decision-making.'),
        p('Our AI systems:'),
        list([
          'Use connected workspace information only with user authorization',
          'Do not sell customer data',
          'Do not use private customer workspace data to train our own foundation models',
          'Prioritize transparency and source-backed responses where possible',
        ]),
      ],
    },
    {
      heading: 'Future Compliance',
      blocks: [
        p('As our company grows, we intend to pursue industry-recognized security and privacy certifications appropriate for our customers and the markets we serve.'),
      ],
    },
    {
      heading: 'Questions',
      blocks: [email('contactsupport@kloyya.com')],
    },
  ],
};

export const HELP_CENTER: LegalDoc = {
  title: 'Kloyya Help Center',
  effectiveDate: 'August 2026',
  intro: ['Welcome to the Kloyya Help Center.', 'Everything you need to get started with Kloyya.'],
  sections: [
    {
      heading: 'Creating an Account',
      blocks: [p('Create your Kloyya account using your email address and verify your account before signing in.')],
    },
    {
      heading: 'Connecting Your Tools',
      blocks: [
        p('You can securely connect supported services, including:'),
        list(['Gmail', 'Google Calendar', 'Google Drive', 'OneDrive', 'Notion']),
        p('Additional integrations will be added over time.'),
      ],
    },
    {
      heading: 'Uploading Files',
      blocks: [
        p('Upload documents including PDFs, Word documents, spreadsheets, presentations, and images so Kloyya can help you search, organize, and understand your information.'),
      ],
    },
    {
      heading: 'Morning Brief',
      blocks: [
        p('Every morning, Kloyya generates a personalized briefing summarizing:'),
        list(['Meetings', 'Important emails', 'Tasks', 'Priorities', 'Deadlines', 'Recommended actions']),
      ],
    },
    {
      heading: 'Search',
      blocks: [
        p('Ask questions in natural language.'),
        p('Kloyya searches across your connected workspace and provides relevant answers using your authorized information.'),
      ],
    },
    {
      heading: 'AI',
      blocks: [
        p('Kloyya can help you:'),
        list(['Research', 'Summarize documents', 'Draft content', 'Organize work', 'Prepare meetings', 'Answer questions', 'Prioritize tasks']),
      ],
    },
    {
      heading: 'Billing',
      blocks: [
        p('Manage your subscription from your account settings.'),
        p('You can:'),
        list(['Upgrade', 'Downgrade', 'Cancel', 'Update payment information']),
      ],
    },
    {
      heading: 'Privacy',
      blocks: [p('You control your connected services.'), p('Disconnecting an integration stops future synchronization.')],
    },
    {
      heading: 'Frequently Asked Questions',
      blocks: [
        h3('Does Kloyya read all my emails?'),
        p('No. Kloyya only accesses information that you authorize and processes it to provide requested features.'),
        h3('Can I disconnect my tools?'),
        p('Yes. You may disconnect integrations at any time.'),
        h3('Can I delete my account?'),
        p('Yes. You can request deletion of your account and associated data in accordance with our Privacy Policy.'),
        h3('Does Kloyya train AI models using my data?'),
        p('No. Kloyya processes your information to provide services within your workspace. We do not use your private workspace data to train our own foundation models.'),
      ],
    },
    {
      heading: 'Need more help?',
      blocks: [email('contactsupport@kloyya.com')],
    },
  ],
};

export interface ContactChannel {
  label: string;
  description: string;
  email: string;
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  { label: 'General', description: 'Questions about Kloyya, partnerships, or the company.', email: 'contactsupport@kloyya.com' },
  { label: 'Customer Support', description: 'Need help using Kloyya?', email: 'contactsupport@kloyya.com' },
  { label: 'Sales', description: 'Interested in Business or Enterprise plans?', email: 'contactsupport@kloyya.com' },
  { label: 'Security', description: 'Report a security issue or vulnerability.', email: 'contactsupport@kloyya.com' },
  { label: 'Privacy', description: 'Questions about your personal information or privacy rights.', email: 'contactsupport@kloyya.com' },
  { label: 'Compliance', description: 'Questions regarding compliance or enterprise requirements.', email: 'contactsupport@kloyya.com' },
  { label: 'Legal', description: 'Legal notices and requests.', email: 'contactsupport@kloyya.com' },
];

export const CONTACT_RESPONSE_TIME =
  'Our goal is to respond to all inquiries within 1–2 business days. Security-related reports are prioritized and reviewed as quickly as possible.';
