import { redirect } from 'next/navigation';

/**
 * Kloyya has no marketing surface in this codebase — the V1 Frontend Build spec
 * states the landing page lives elsewhere and must not be modified here.
 *
 * `/` therefore resolves straight into the product. Once the auth middleware
 * lands (Phase 5) it will forward an existing session to /dashboard instead.
 */
export default function RootPage(): never {
  redirect('/login');
}
