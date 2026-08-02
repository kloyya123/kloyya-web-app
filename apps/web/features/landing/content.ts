/**
 * Landing page copy, in one place.
 *
 * Separated from the components so the words can be edited without touching
 * layout — marketing copy changes far more often than the markup around it.
 * Every claim here has to stay true of the shipped product; a landing page that
 * promises a capability the app does not have is a bug, not a stretch goal.
 */

/**
 * The one address Kloyya answers.
 *
 * Defined once because the site previously advertised three — hello@, support@
 * and press@ — of which only this one exists. A footer link to an address that
 * bounces is worse than no link: the visitor writes, hears nothing, and
 * concludes we ignored them.
 */
export const CONTACT_EMAIL = 'contactsupport@kloyya.com';

export interface Feature {
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  {
    title: 'Reads your mail',
    body: 'Finds the threads where someone is genuinely waiting on you, and holds back the ones that are not. Nothing is deleted — it is moved out of the way and stays searchable.',
  },
  {
    title: 'Replies on your behalf',
    body: 'Kloyya writes the response in your voice and holds it for approval. Send, edit, or discard. Grant standing permission for the routine ones and revoke it at any time.',
  },
  {
    title: 'Knows your schedule',
    body: 'Every meeting arrives with a briefing built from the threads and documents behind it, so you walk in already caught up.',
  },
  {
    title: 'Remembers your documents',
    body: 'Indexes what is in Drive and Notion and connects it to the decisions it belongs to. When a number changes, Kloyya notices what still shows the old one.',
  },
  {
    title: 'Answers in plain language',
    body: 'Ask anything about your own work and get an answer with its sources attached — not a results page you have to read yourself.',
  },
];

export interface Role {
  name: string;
  body: string;
}

export const ROLES: Role[] = [
  { name: 'Founders', body: 'Investor threads, board prep, and the three decisions actually worth your Tuesday.' },
  { name: 'Executives', body: 'One briefing each morning covering what your teams changed while you were asleep.' },
  { name: 'Managers', body: 'One-to-one prep written from the week’s real threads, and the promises you owe people.' },
  { name: 'Makers', body: 'Focus blocks defended, interruptions batched, nothing critical missed.' },
  { name: 'Students', body: 'Readings, deadlines, and lecture notes gathered into something you can revise from.' },
  { name: 'Freelancers', body: 'Every client in one place, with the file and the deadline attached to each one.' },
];

export interface Tool {
  name: string;
  /** Connectable today, or on the roadmap. */
  live: boolean;
}

/**
 * What a visitor is told they can connect — and only that.
 *
 * Every entry here is connectable today. Outlook and Slack used to appear as
 * "Next", which reads as a roadmap promise rather than a fact, and Outlook in
 * particular is currently hidden from the product's own UI pending its Azure
 * redirect URI. Advertising a tool the app will not let you connect is the kind
 * of small dishonesty that costs trust on the first click.
 */
export const TOOLS: Tool[] = [
  { name: 'Gmail', live: true },
  { name: 'Google Calendar', live: true },
  { name: 'Google Drive', live: true },
  { name: 'Notion', live: true },
];

export interface Plan {
  name: string;
  price: string;
  period?: string;
  features: string[];
  featured?: boolean;
}

/**
 * Deliberately vague about the Free allowance ("limited asks per day") rather
 * than naming a number: the entitlement is still being tuned, and a landing
 * page that quotes a figure the product later changes is a promise broken.
 */
export const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    features: [
      'Connect your core tools',
      'Limited asks per day',
      'Daily briefing',
      'Inbox triage',
      'Drafted replies, approved by you',
    ],
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/mo',
    featured: true,
    features: [
      'Everything in Free',
      'Unlimited asks',
      'Unlimited documents',
      'Standing permissions for routine replies',
      'Early access to new tools',
    ],
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'Will Kloyya send email as me?',
    a: 'Only when you allow it. Out of the box Kloyya drafts and stops — every reply waits for you to send, edit, or discard. If you would rather it handled the routine traffic itself, you can grant standing permission per category and see a log of everything it sent. Revoke any of it in one click.',
  },
  {
    q: 'What can Kloyya see?',
    a: 'Only the tools you connect. Read access is the default and the minimum; anything that writes is a separate, explicit switch. Everything is encrypted in transit and at rest, and disconnecting a tool stops access immediately.',
  },
  {
    q: 'Do you train models on my work?',
    a: 'No. Your content is used to answer your questions and nothing else. It is never used to train models, never sold, and never shared with another customer.',
  },
  {
    q: 'What does “limited asks per day” mean on Free?',
    a: 'Free includes a daily allowance of questions — enough for normal daily use. If you reach it, Kloyya says so plainly and the allowance resets the next morning. Pro removes the limit.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'The web app works on your phone today. Native iOS and Android apps are in development, and people already using Kloyya get them first.',
  },
  {
    q: 'What happens if I delete my account?',
    a: 'Your connections are revoked immediately and all stored content is permanently deleted within 30 days. You can export everything first from Settings.',
  },
];
