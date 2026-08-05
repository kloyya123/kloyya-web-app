import type { IntegrationCategory } from '@/types/integrations';

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
  /** The catalogue id, where one exists — feeds the real icon lookup in
   *  integration-meta.ts rather than a bespoke landing-page icon set. */
  id: string;
  category: IntegrationCategory;
}

/**
 * What a visitor is told they can connect.
 *
 * Every `live: true` entry is connectable today; the flag is what keeps the
 * grid honest rather than aspirational — Outlook is hidden from the product's
 * own UI pending its Azure redirect URI, and stays off this list for the same
 * reason. Slack is listed on request but marked `live: false`: there is no
 * OAuth flow, no catalogue entry, and no sync for it yet, so showing it as
 * connectable would be the exact small dishonesty this file exists to avoid.
 */
export const TOOLS: Tool[] = [
  { name: 'Gmail', live: true, id: 'gmail', category: 'communication' },
  { name: 'Google Calendar', live: true, id: 'google_calendar', category: 'calendar' },
  { name: 'Google Drive', live: true, id: 'google_drive', category: 'documents' },
  { name: 'Notion', live: true, id: 'notion', category: 'documents' },
  { name: 'Slack', live: false, id: 'slack', category: 'communication' },
];

export interface Plan {
  name: string;
  price: string;
  period?: string;
  /** A yearly alternative to the monthly price, shown as its own labeled row. */
  yearlyPrice?: string;
  /** What the yearly price saves versus paying monthly all year, e.g. "$48". */
  yearlySavings?: string;
  features: string[];
  featured?: boolean;
}

/**
 * One plan for now. Student, Founder, and Business tiers are coming later —
 * see the closing note under the card rather than half-building them here.
 */
export const TRIAL_NOTE = 'Start with a 30-day free trial. Full access, no card required.';

/** Shown once, under the pricing card — not a priced tier, just what's next. */
export const PRICING_FOOTNOTE =
  'Students get a discount — reach out once you’re signed in. Founder and Business plans are coming.';

export const PLANS: Plan[] = [
  {
    name: 'Pro',
    price: '$20',
    period: '/mo',
    yearlyPrice: '$192/yr',
    yearlySavings: '$48',
    featured: true,
    features: [
      'Connect your core tools',
      'Unlimited asks',
      'Unlimited documents',
      'Daily briefing',
      'Inbox triage',
      'Drafted replies, approved by you',
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
    q: 'What happens after the 30-day trial?',
    a: 'You move to Pro at $20/mo (or $192/yr) if you’d like to keep going — nothing is charged automatically at day 31. Students get a discount; reach out once you’re signed in.',
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
