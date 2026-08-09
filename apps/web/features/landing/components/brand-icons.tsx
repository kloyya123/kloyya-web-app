import type { ComponentType } from 'react';

/** Matches the callable shape of lucide-react's `LucideIcon`, so a brand icon
 *  and a fallback `integrationIcon()` result are interchangeable at call sites. */
interface BrandIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

/**
 * Real, brand-colored marks for the five tools the landing page names.
 *
 * The connections catalogue (`integration-meta.ts`) deliberately uses generic
 * outline icons instead of vendor logos — bundling ~50 brand SVGs would bloat
 * the app and raise licensing questions for tools most users never see. This
 * page names only five, all of them requested by name in the copy itself, so
 * a visitor reading "Gmail" or "Slack" sees the mark they already recognize
 * rather than a generic envelope. Scoped to the landing page; the product's
 * own UI keeps using `integrationIcon`.
 */

export function GmailIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M5 19h2V9.5l5 3.75 5-3.75V19h2a1 1 0 0 0 1-1V6.5a1.5 1.5 0 0 0-2.4-1.2L12 10 5.4 5.3A1.5 1.5 0 0 0 3 6.5V18a1 1 0 0 0 1 1Z" />
      <path fill="#EA4335" d="M3 6.5 12 13l9-6.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v.5Z" />
      <path fill="#34A853" d="M19 19h-2V9.5l2-1.5V18a1 1 0 0 1-1 1Z" />
      <path fill="#FBBC05" d="M5 19h2V9.5L5 8v10a1 1 0 0 0 1 1Z" />
    </svg>
  );
}

export function GoogleCalendarIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#fff" stroke="#DADCE0" strokeWidth="1" />
      <path fill="#4285F4" d="M3 8h18v3H3z" />
      <rect x="3" y="4" width="18" height="4" rx="2" fill="#1A73E8" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1A73E8" fontFamily="sans-serif">
        31
      </text>
    </svg>
  );
}

export function GoogleDriveIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#0F9D58" d="M8.1 2.5 2 13l3.1 5.4 6.1-10.6z" />
      <path fill="#4285F4" d="M15.9 2.5H8.1l6.1 10.6h7.9z" />
      <path fill="#FFCD40" d="M5.1 18.4h13.8L22 13H2z" />
    </svg>
  );
}

export function NotionIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#fff" stroke="#E9E9E7" strokeWidth="1" />
      <path
        fill="#000"
        d="M7.2 6.4c.5.4 1 .5 1.6.5l7.6-.5c.15 0 .05-.2-.05-.25l-1.25-.9c-.25-.2-.55-.4-1.15-.35l-7.35.5c-.25.05-.35.2-.15.4l.7.55Zm.5 1.9v9.35c0 .5.25.7.8.65l8.4-.5c.5-.05.6-.35.6-.75V7.9c0-.4-.15-.6-.5-.55l-8.85.5c-.35.05-.45.2-.45.45Zm7.75.75c.05.25 0 .5-.25.55l-.4.1v6.1c-.35.2-.65.3-.9.3-.4 0-.5-.15-.8-.5l-2.45-3.9v3.8l.85.2s0 .5-.7.5l-1.9.1c-.05-.1 0-.4.15-.45l.5-.15v-5.3l-.45-.35c-.05-.25.05-.6.4-.65l2.05-.15 2.55 3.95v-3.5l-.7-.1c-.05-.3.15-.5.4-.55Z"
      />
    </svg>
  );
}

export function SlackIcon({ className }: BrandIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#36C5F0" d="M9.3 15.2a1.9 1.9 0 1 1-1.9-1.9h1.9v1.9Z" />
      <path fill="#36C5F0" d="M10.2 15.2a1.9 1.9 0 1 1 3.8 0v4.7a1.9 1.9 0 1 1-3.8 0v-4.7Z" />
      <path fill="#2EB67D" d="M8.8 9.3a1.9 1.9 0 1 1 1.9-1.9v1.9H8.8Z" />
      <path fill="#2EB67D" d="M8.8 10.2a1.9 1.9 0 1 1 0 3.8H4a1.9 1.9 0 1 1 0-3.8h4.8Z" />
      <path fill="#ECB22E" d="M14.7 8.8a1.9 1.9 0 1 1 1.9 1.9h-1.9V8.8Z" />
      <path fill="#ECB22E" d="M13.8 8.8a1.9 1.9 0 1 1-3.8 0V4a1.9 1.9 0 1 1 3.8 0v4.8Z" />
      <path fill="#E01E5A" d="M15.2 14.7a1.9 1.9 0 1 1-1.9 1.9v-1.9h1.9Z" />
      <path fill="#E01E5A" d="M15.2 13.8a1.9 1.9 0 1 1 0-3.8H20a1.9 1.9 0 1 1 0 3.8h-4.8Z" />
    </svg>
  );
}

/** Keyed the same way `TOOLS[i].id` is, so a lookup mirrors `integrationIcon`'s call shape. */
export const BRAND_ICONS: Record<string, ComponentType<BrandIconProps>> = {
  gmail: GmailIcon,
  google_calendar: GoogleCalendarIcon,
  google_drive: GoogleDriveIcon,
  notion: NotionIcon,
  slack: SlackIcon,
};
