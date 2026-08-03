import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Toaster, TooltipProvider } from '@/components/ui';
import { siteUrl } from '@/lib/site-url';
import { parseSessionCookie, SESSION_COOKIE_NAME } from '@/services/auth/session-store';
import { AnalyticsProvider } from '@/providers/analytics-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import '@/styles/globals.css';

/** KDS: "Primary Typeface: Inter." Loaded as a variable font, self-hosted by Next. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * A serif for the marketing page only — KDS specifies Inter for the product,
 * so this is deliberately kept out of the design-system font stack and used
 * nowhere the app itself renders. Loaded here rather than per-page because
 * next/font requires a module-scope call; exposing the variable at the root
 * costs nothing when unused, and the landing page is the only place `font-serif`
 * is ever applied. Italic is loaded because the marketing page leans on it for
 * emphasis (see the hero) rather than synthesizing a fake italic in the browser.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  // Without a base, the relative `canonical` and Open Graph URLs on the landing
  // page resolve to nothing and Next warns on every build.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Kloyya',
    template: '%s · Kloyya',
  },
  description: 'The Intelligence Behind Every Decision.',
  applicationName: 'Kloyya',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B1020' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read the session on the server so the shell and its content render on the
  // first response, not after a client round-trip. Middleware has already
  // decided whether this request is allowed to be here; this only decides what
  // to paint.
  const cookieStore = await cookies();
  const initialSession = parseSessionCookie(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );

  return (
    // suppressHydrationWarning: next-themes writes the theme class onto <html>
    // before React hydrates, so server and client markup differ here by design.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider initialSession={initialSession}>
              <AnalyticsProvider>
                <TooltipProvider delayDuration={300}>
                {/* WCAG 2.4.1 bypass block. Hidden until it receives focus. */}
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:bg-card focus:text-foreground focus:shadow-level-3 focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
                >
                  Skip to content
                </a>
                  {children}
                  <Toaster />
                </TooltipProvider>
              </AnalyticsProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
