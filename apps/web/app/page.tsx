import { redirect } from 'next/navigation';

/**
 * `/` redirects straight to `/login`.
 *
 * The marketing site now lives at kloyya.com (a separate repo/deployment),
 * so this app only needs to get a visitor to login or signup. Middleware
 * excludes `/` from the disallowed-user waitlist bounce so an unauthenticated
 * visitor reaches this route and lands here; a fully provisioned, authenticated
 * visitor is redirected to their dashboard by middleware before this even runs.
 */
export default function RootPage() {
  redirect('/login');
}
