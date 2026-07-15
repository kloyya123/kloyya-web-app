'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * KDS: "Dark mode is the default experience." and "Theme switching should be
 * instantaneous."
 *
 * `defaultTheme="dark"` honors the first. `disableTransitionOnChange` honors the
 * second — without it, every color token animates through its transition on
 * toggle, producing a visible smear rather than an instant switch.
 *
 * `enableSystem` lets the OS preference win on first visit only; an explicit
 * user choice is persisted and thereafter takes precedence.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
