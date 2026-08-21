import type { Metadata } from 'next';
import { safeRedirect } from '@/lib/safe-redirect';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Kloyya and pick up your briefing, inbox, and drafts where you left them.',
  /**
   * Indexed on purpose, despite holding nothing a searcher wants to read.
   *
   * People search "kloyya login" and expect to land on the form. It is also one
   * of the handful of pages Google can offer as a sitelink under the main
   * result, and it can only do that for pages it is allowed to index — so
   * `noindex` here quietly costs the whole sitelink block.
   */
  robots: { index: true, follow: true },
  alternates: { canonical: '/login' },
};

/**
 * `next` is read and validated here, on the server, rather than with
 * `useSearchParams` in the form.
 *
 * Two reasons, in order of importance:
 *
 *   1. `useSearchParams` opts its entire subtree out of prerendering. The form
 *      would ship as a client-only island behind a skeleton — slower first
 *      paint, and nothing at all without JavaScript.
 *   2. It sanitizes the attacker-controlled redirect target one layer earlier.
 *      The client receives a value that is already known-safe.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.next;
  // A repeated `?next=a&next=b` arrives as an array. Take neither.
  const next = typeof raw === 'string' ? raw : null;

  return <LoginForm redirectTo={safeRedirect(next, '/dashboard')} />;
}
