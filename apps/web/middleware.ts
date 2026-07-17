import { NextResponse, type NextRequest } from 'next/server';
import { safeRedirect } from '@/lib/safe-redirect';
import { SESSION_COOKIE_NAME } from '@/services/auth/session-store';

/**
 * Route protection, enforced on the server before any protected markup is sent.
 *
 * Doing this client-side would render the dashboard shell, then redirect — a
 * visible flash of content the user is not authorized to see, and a window in
 * which its data fetches have already fired.
 *
 * SECURITY BOUNDARY. This middleware reads an *unsigned* mock cookie, so it is
 * a routing convenience, not an authorization control. Nothing here is trusted:
 * with a real backend, every API call independently authorizes the caller, and
 * this middleware's only job remains sending the user to the right screen.
 * Never let a route guard be the thing that protects data.
 */

const ROOT = '/';
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];

/** Reachable while authenticated but not yet fully provisioned. */
const PROVISIONING_ROUTES = ['/verify-email', '/onboarding', '/workspace-init'];

interface SessionShape {
  user?: { isEmailVerified?: boolean; hasCompletedOnboarding?: boolean };
  organization?: unknown;
  workspace?: unknown;
  preferences?: unknown;
}

function readSessionCookie(request: NextRequest): SessionShape | null {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const session = JSON.parse(decodeURIComponent(raw)) as SessionShape;
    // No expiry check: the cookie's Max-Age already means an expired session is
    // never sent here, and the API independently authorizes every call anyway.
    // A session missing the pieces the app renders from (org, workspace,
    // preferences) must read as no session, not as a half-authenticated state
    // that lets a page through only to crash on `organization.name` — or, worse,
    // to sit on a skeleton forever because the client guard rejected what this
    // one allowed. These two guards must agree; keep them in step.
    if (
      !session.user ||
      !session.organization ||
      !session.workspace ||
      !session.preferences
    ) {
      return null;
    }
    return session;
  } catch {
    // A tampered or truncated cookie means "not signed in", never "crash".
    return null;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const session = readSessionCookie(request);

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isProvisioning = PROVISIONING_ROUTES.some((route) => pathname.startsWith(route));

  // Unauthenticated: everything except the public routes goes to login, with a
  // validated return path so the user lands where they were headed.
  if (!session) {
    if (isPublic) return NextResponse.next();

    const login = new URL('/login', request.url);
    // `?next=/` would send the user back to a route that only ever redirects.
    if (pathname !== ROOT) {
      login.searchParams.set('next', `${pathname}${search}`);
    }
    return NextResponse.redirect(login);
  }

  const isVerified = session.user?.isEmailVerified === true;
  const isOnboarded = session.user?.hasCompletedOnboarding === true;

  // Authenticated but unverified: the only way forward is the code.
  if (!isVerified) {
    return pathname.startsWith('/verify-email')
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/verify-email', request.url));
  }

  // Verified but not onboarded: the only way forward is onboarding.
  if (!isOnboarded) {
    return pathname.startsWith('/onboarding')
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Fully provisioned. Bounce away from `/`, the auth screens, and the
  // provisioning screens — a signed-in user has no business on the login page.
  //
  // `/` is handled here rather than by app/page.tsx so a provisioned user goes
  // straight to the dashboard, instead of visiting /login and being bounced back.
  if (pathname === ROOT || isPublic || isProvisioning) {
    // Two provisioning routes run *after* onboarding completes, on the way to
    // the dashboard, so a provisioned user may see them: connect-tools (wire up
    // existing tools before the workspace is created) and workspace-init (the
    // first sync). Everything else provisioning-shaped bounces to the dashboard.
    if (
      pathname.startsWith('/workspace-init') ||
      pathname.startsWith('/onboarding/connect-tools')
    ) {
      return NextResponse.next();
    }

    const next = request.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(safeRedirect(next, '/dashboard'), request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next internals, static assets, and the favicon. Running on
   * `/_next/static` would add a cookie parse to every chunk request.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
