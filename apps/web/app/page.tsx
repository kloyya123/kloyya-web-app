import { redirect } from 'next/navigation';

/**
 * `/` redirects straight to `/login`.
 *
 * The marketing site now lives at kloyya.com (a separate repo/deployment),
 * so this app only needs to get a visitor to login or signup. Middleware
 * treats `/` as public, so an unauthenticated visitor reaches this route
 * and is bounced immediately; an authenticated one is redirected to their
 * dashboard by middleware before this even runs.
 */
export default function RootPage() {
  redirect('/login');
}
