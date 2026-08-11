import type { SVGProps } from 'react';

/**
 * Real brand logos for the connected tools.
 *
 * The integration cards used generic outline icons (an envelope for Gmail, a
 * folder for Drive); the reference wants the actual, recognizable marks. These
 * are compact, self-contained SVGs — no external asset, no network — in each
 * brand's own colors, so Gmail reads as Gmail at a glance.
 *
 * They are decorative by design: every place they render, the tool's name sits
 * next to them as the accessible label, so the marks are `aria-hidden`.
 */
type IconProps = SVGProps<SVGSVGElement>;

const BASE = { viewBox: '0 0 48 48', 'aria-hidden': true } as const;

export function GmailLogo(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path fill="#fff" d="M6 12h36v26H6z" />
      <path fill="#4285F4" d="M8 38h6V22l-6-4.5z" />
      <path fill="#34A853" d="M40 38h-6V22l6-4.5z" />
      <path fill="#FBBC04" d="M8 14.5V22l6 4.5V19l10 7.5L34 19v7.5L40 22v-7.5A2.5 2.5 0 0 0 37.5 12H37l-13 9.7L11 12h-.5A2.5 2.5 0 0 0 8 14.5z" />
      <path fill="#EA4335" d="M8 14.5 24 26.5 40 14.5A2.5 2.5 0 0 0 37.5 12H37l-13 9.7L11 12h-.5A2.5 2.5 0 0 0 8 14.5z" opacity=".9" />
    </svg>
  );
}

export function GoogleCalendarLogo(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <rect x="10" y="10" width="28" height="28" rx="3" fill="#fff" stroke="#DADCE0" />
      <path fill="#34A853" d="M32 32h6V16h-6z" />
      <path fill="#EA4335" d="M16 32h16v6H16z" />
      <path fill="#188038" d="M10 32h6v6h-3a3 3 0 0 1-3-3z" />
      <path fill="#1967D2" d="M10 16h6v16h-6z" />
      <path fill="#FBBC04" d="M10 13a3 3 0 0 1 3-3h19v6H10z" />
      <text x="24" y="29" fontSize="12" fontFamily="Arial, sans-serif" fontWeight="700" fill="#4285F4" textAnchor="middle">31</text>
    </svg>
  );
}

export function GoogleDriveLogo(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path fill="#00AC47" d="M17 8h14l-5.5 9.5H11.5z" />
      <path fill="#EA4335" d="M42 27H20l-5.5 9.5h22z" />
      <path fill="#00832D" d="m17 8 5.5 9.5L11.5 36.5 6 27z" />
      <path fill="#2684FC" d="M42 27 31 8l-5.5 9.5L36.5 36.5z" />
      <path fill="#FFBA00" d="M14.5 36.5 20 27h22l-5.5 9.5z" />
    </svg>
  );
}

export function NotionLogo(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <rect x="8" y="8" width="32" height="32" rx="5" fill="#fff" stroke="#E6E6E4" />
      <path
        fill="#000"
        d="M18 16.5 27 17v13l-2.5.3-6-8.6V29l-2.4.4V17zm-1.6-.2 8.8-.6c1-.1 1.3 0 1.9.5l2.4 1.7c.4.3.5.5.5 1v13.2c0 .6-.2.9-1 .95l-9.4.6c-.6 0-.9-.1-1.2-.6l-2.3-3c-.3-.4-.4-.7-.4-1.1V17.4c0-.5.2-1 1.3-1.1z"
      />
    </svg>
  );
}

export function SlackLogo(props: IconProps) {
  return (
    <svg {...BASE} {...props}>
      <path fill="#36C5F0" d="M20 10a4 4 0 1 0-8 0 4 4 0 0 0 4 4h4z" />
      <path fill="#2EB67D" d="M38 20a4 4 0 1 0 0-8 4 4 0 0 0-4 4v4z" />
      <path fill="#ECB22E" d="M28 38a4 4 0 1 0 8 0 4 4 0 0 0-4-4h-4z" />
      <path fill="#E01E5A" d="M10 28a4 4 0 1 0 0 8 4 4 0 0 0 4-4v-4z" />
      <path fill="#2EB67D" d="M28 14a4 4 0 0 1 8 0v4a4 4 0 0 1-8 0z" />
      <path fill="#E01E5A" d="M20 34a4 4 0 0 1-8 0v-4a4 4 0 0 1 8 0z" />
    </svg>
  );
}

/** The integrations Kloyya has a real brand mark for, by catalogue id. */
const BRAND_LOGOS: Record<string, (props: IconProps) => React.JSX.Element> = {
  gmail: GmailLogo,
  google_calendar: GoogleCalendarLogo,
  google_drive: GoogleDriveLogo,
  notion: NotionLogo,
  slack: SlackLogo,
};

export function hasBrandLogo(id: string): boolean {
  return id in BRAND_LOGOS;
}

/** Render a tool's real brand logo. Returns null for ids we have no mark for. */
export function IntegrationBrandLogo({ id, className }: { id: string; className?: string }) {
  const Logo = BRAND_LOGOS[id];
  return Logo ? <Logo className={className} /> : null;
}
