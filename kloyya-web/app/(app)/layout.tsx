import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

/**
 * Every authenticated route inherits the shell. Middleware has already verified
 * the session, so nothing here needs to guard.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
