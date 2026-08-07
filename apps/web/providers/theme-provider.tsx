'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Light only, by request — dark mode has been removed from the app entirely
 * (the marketing site is unaffected; it never used this provider).
 *
 * `forcedTheme="light"` is the real lock: it ignores OS preference and any
 * previously-stored choice, so there is no path back to a dark render even
 * from a stale `theme` value in localStorage. `defaultTheme="light"` is kept
 * alongside it for the same reason a forced value still names its default —
 * documentation, not a second mechanism.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      {children}
    </NextThemeProvider>
  );
}
