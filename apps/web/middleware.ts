import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { describeAllowlist, isBetaAllowed } from '@/lib/beta-access';
import { safeRedirect } from '@/lib/safe-redirect';
import { SESSION_COOKIE_NAME } from '@/services/auth/session-store';

/**
 * Route protection, enforced on the server before any protected markup is sent.
 *
 * Doing this client-side would render the dashboard shell, then redirect — a
 * visible flash of content the user is not authorized to see. This runs first.
 *
 * SECURITY BOUNDARY. This is a routing convenience, not an authorization control:
 * every API route independently authorizes its caller (validating the Supabase
 * JWT server-side). Never let a route guard be the thing that protects data.
 *
 * Two backends, one gate: with the real backend it reads the Supabase session
 * (and refreshes it, carrying the rotated cookies onto every response); with the
 * mock it reads the unsigned demo cookie. The decision tree — where each of
 * {unauthenticated, unverified, un-onboarded, provisioned} may go — is shared.
 */
const USE_REAL_API = process.env['NEXT_PUBLIC_USE_REAL_API'] === 'true';

const ROOT = '/';
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];
/** Reachable while authenticated but not yet fully provisioned. */
const PROVISIONING_ROUTES = ['/verify-email', '/onboarding', '/workspace-init'];
/** Where a signed-in account that is not on the allowlist is held. */
const WAITLIST_WALL = '/waitlist';

interface AuthState {
  authed: boolean;
  verified: boolean;
  onboarded: boolean;
  /** On the access allowlist. See lib/beta-access.ts. */
  allowed: boolean;
}

/**
 * The shared gate tree. `carry` is an already-built response whose cookies (the
 * refreshed Supabase session) must survive onto any redirect — the canonical
 * @supabase/ssr pitfall is dropping them.
 */
function decide(request: NextRequest, state: AuthState, carry: NextResponse): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isProvisioning = PROVISIONING_ROUTES.some((route) => pathname.startsWith(route));

  const redirect = (to: URL) => {
    const res = NextResponse.redirect(to);
    for (const cookie of carry.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  // Unauthenticated: everything except the public routes goes to login, with a
  // validated return path so the user lands where they were headed. `/` is
  // public too — it is the marketing page, and bouncing a first-time visitor
  // to a password field is how you lose them before they know what Kloyya is.
  if (!state.authed) {
    if (isPublic || pathname === ROOT) return carry;
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return redirect(login);
  }

  // Signed in, but not on the allowlist.
  //
  // Checked before verification and onboarding on purpose: walking someone
  // through an email code and an eight-step wizard only to refuse them at the
  // end would be a cruel way to spend their time.
  if (!state.allowed) {
    if (pathname === WAITLIST_WALL || pathname === ROOT) return carry;
    return redirect(new URL(WAITLIST_WALL, request.url));
  }

  // An allowed user has no reason to sit on the wall.
  if (pathname === WAITLIST_WALL) return redirect(new URL('/dashboard', request.url));

  // Authenticated but unverified: the only way forward is the code.
  if (!state.verified) {
    return pathname.startsWith('/verify-email') ? carry : redirect(new URL('/verify-email', request.url));
  }

  // Verified but not onboarded: the only way forward is onboarding.
  if (!state.onboarded) {
    return pathname.startsWith('/onboarding') ? carry : redirect(new URL('/onboarding', request.url));
  }

  // Fully provisioned. Bounce away from `/`, the auth screens, and the
  // provisioning screens — a signed-in user has no business on the login page.
  if (pathname === ROOT || isPublic || isProvisioning) {
    // Two provisioning routes run AFTER onboarding, on the way to the dashboard,
    // so a provisioned user may see them: connect-tools and workspace-init.
    if (pathname.startsWith('/workspace-init') || pathname.startsWith('/onboarding/connect-tools')) {
      return carry;
    }
    const next = request.nextUrl.searchParams.get('next');
    return redirect(new URL(safeRedirect(next, '/dashboard'), request.url));
  }

  return carry;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (!USE_REAL_API) return mockMiddleware(request);

  // Build the response first so the Supabase client can write refreshed cookies
  // onto it, then let `decide` carry those cookies onto whatever it returns.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // ✅ CORRECTION : Mutation propre de l'objet réponse existant.
        // Plus de réassignation `response = NextResponse.next()` qui écrasait les en-têtes/cookies précédents.
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser (not getSession) revalidates the JWT and refreshes it if stale.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return withGateHeader(
    decide(
      request,
      {
        authed: Boolean(user),
        verified: Boolean(user?.email_confirmed_at),
        onboarded: user?.user_metadata?.['onboarded'] === true,
        // From the verified JWT's email claim, never a header or query parameter.
        allowed: isBetaAllowed(user?.email),
      },
      response,
    ),
  );
}

/** The mock branch: read the unsigned demo cookie. No cookies to carry. */
function mockMiddleware(request: NextRequest): NextResponse {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let state: AuthState = {
    authed: false,
    verified: false,
    onboarded: false,
    allowed: false,
  };

  if (raw) {
    try {
      const s = JSON.parse(decodeURIComponent(raw)) as {
        user?: { isEmailVerified?: boolean; hasCompletedOnboarding?: boolean; email?: string };
        organization?: unknown;
        workspace?: unknown;
        preferences?: unknown;
      };
      // A session missing what the app renders from must read as no session.
      if (s.user && s.organization && s.workspace && s.preferences) {
        state = {
          authed: true,
          verified: s.user.isEmailVerified === true,
          onboarded: s.user.hasCompletedOnboarding === true,
          allowed: isBetaAllowed(s.user.email),
        };
      }
    } catch {
      // A tampered cookie means "not signed in", never "crash".
    }
  }

  return withGateHeader(decide(request, state, NextResponse.next()));
}

/**
 * Report what the gate can see, as a response header.
 *
 * TEMPORARY. The previous version of this gate refused an allowlisted address
 * and the cause could never be established, because nothing about the check was
 * observable from outside — a missing variable, a malformed one, and a session
 * without an email all produced the same wall.
 *
 * Middleware runs on the Edge runtime, so its view of the environment is not
 * necessarily an API route's view; this header is the only way to read the Edge
 * side directly. It carries a count and entry LENGTHS, never an address, so a
 * stray quote or trailing space shows up as a wrong length without publishing
 * anyone's email. Remove once the gate is confirmed working.
 */
function withGateHeader(response: NextResponse): NextResponse {
  response.headers.set('x-kloyya-gate', describeAllowlist());
  return response;
}

export const config = {
  /**
   * Everything except Next internals, the API routes (they authorize
   * themselves — running the page-gate here would turn a 401 into an HTML
   * redirect), static assets, and the favicon.
   *
   * robots.txt and sitemap.xml are excluded too: they are generated routes, so
   * without this the gate answers a crawler with a redirect to /login and the
   * site never gets indexed.
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
