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
 * {unauthenticated, unverified, un-onboarded, allowed, provisioned} may go — is
 * shared.
 *
 * The allowlist is back, by request, scoped to two addresses. Sign-up and
 * sign-in still go straight to Supabase, so an account not on the list CAN be
 * created — that call never passes through our server. What it cannot do is
 * reach the app: this runs on every request. See lib/beta-access.ts.
 */
const USE_REAL_API = process.env['NEXT_PUBLIC_USE_REAL_API'] === 'true';

/**
 * The marketing page, and the one route a stranger is meant to land on.
 *
 * Kept out of PUBLIC_ROUTES deliberately: that list is matched with
 * `startsWith`, and '/' is a prefix of every path, so adding it there would
 * quietly make the entire app public.
 */
const ROOT = '/';
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/privacy', '/terms'];
/** Reachable while authenticated but not yet fully provisioned. */
const PROVISIONING_ROUTES = ['/verify-email', '/onboarding', '/workspace-init'];

/**
 * Setting a new password, reached from the emailed reset link.
 *
 * Exempt from every branch below, in both directions. Supabase establishes a
 * recovery SESSION when the link is followed, so by the time this screen loads
 * the visitor is authenticated — which would otherwise send them straight to
 * /dashboard, past the one screen they came here to use. Equally it must work
 * when no session exists yet, so the link is never a dead end.
 */
const RESET_PASSWORD = '/reset-password';

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
export function decide(request: NextRequest, state: AuthState, carry: NextResponse): NextResponse {
  const { pathname, search } = request.nextUrl;
  // Exact match on ROOT, prefix match on the rest — see ROOT above for why.
  const isPublic =
    pathname === ROOT || PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isProvisioning = PROVISIONING_ROUTES.some((route) => pathname.startsWith(route));

  const redirect = (to: URL) => {
    const res = NextResponse.redirect(to);
    for (const cookie of carry.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  // The reset screen is exempt from the whole tree — see RESET_PASSWORD above.
  if (pathname.startsWith(RESET_PASSWORD)) return carry;

  // Unauthenticated: everything except the public routes goes to login, with a
  // validated return path so the user lands where they were headed. `/` is
  // public, so a stranger gets the marketing page rather than a login form.
  if (!state.authed) {
    if (isPublic) return carry;
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return redirect(login);
  }

  // Signed in, but not on the allowlist.
  //
  // Checked before verification and onboarding on purpose: walking someone
  // through an email code and the onboarding wizard only to refuse them at the
  // end would be a cruel way to spend their time. `/` already carries for
  // everyone (see below), so a disallowed visitor lands on the one page that
  // has the waitlist on it — nothing special-cased here needs a dedicated
  // wall route the way it once did.
  if (!state.allowed) {
    if (pathname === ROOT) return carry;
    return redirect(new URL('/#waitlist', request.url));
  }

  // Authenticated but unverified: the only way forward is the code.
  if (!state.verified) {
    return pathname.startsWith('/verify-email') ? carry : redirect(new URL('/verify-email', request.url));
  }

  // Verified but not onboarded: the only way forward is onboarding.
  //
  // /workspace-init counts as forward, not backward. It runs immediately AFTER
  // the wizard, and the `onboarded` flag it is measured against is stamped into
  // user_metadata best-effort (see server/users/metadata.ts) — the database is
  // the source of truth, that stamp is a convenience for this very check. When
  // the stamp fails the flag stays false, and without this exemption pressing
  // Continue on the connect-tools screen bounced the user back to the start of
  // the wizard they had just finished: a silent loop that looks like a dead
  // button. Provisioning is idempotent, so letting it through is safe.
  if (!state.onboarded) {
    const movingForward =
      pathname.startsWith('/onboarding') || pathname.startsWith('/workspace-init');
    return movingForward ? carry : redirect(new URL('/onboarding', request.url));
  }

  // `/` stays the marketing page even when signed in.
  //
  // It used to forward to /dashboard, which was right while the app had its own
  // domain and `/` was merely "the logged-out state". Now that kloyya.com is the
  // company's public front door, that rule hid the pricing and FAQ from the very
  // people most likely to look them up, and made a shared kloyya.com link open
  // someone's dashboard instead of the page they were sent. The header offers
  // them the way back into the product.
  if (pathname === ROOT) return carry;

  // The public surface — `/`, /login, /signup, /forgot-password — renders for
  // everyone, signed in or not.
  //
  // These used to forward a signed-in visitor to /dashboard, which meant the
  // landing page's own "Log in" and "Sign up" buttons dropped anyone with a
  // stale session straight into the app. Clicking Sign up and landing on a
  // dashboard is not a redirect a person can make sense of, and it read as the
  // page being broken. Nothing depends on the bounce: the login form navigates
  // itself with `router.replace(redirectTo)` once credentials are accepted.
  if (isPublic) return carry;

  // Provisioning screens are different — they are steps in a flow, not pages.
  // A finished account has no reason to be standing in one.
  if (isProvisioning) {
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
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
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
        allowed: isBetaAllowed(user?.email),
      },
      response,
    ),
  );
}

/**
 * TEMPORARY, same reasoning as the last time this gate existed: an earlier
 * version once refused an allowlisted address and the cause was never
 * established, because nothing about the check was observable from outside —
 * a missing variable, a malformed one, and a session without an email all
 * produced the same wall. This header carries a count and entry LENGTHS,
 * never an address, so a stray quote or trailing space shows up as a wrong
 * length without publishing anyone's email. Remove once this configuration is
 * confirmed working end to end.
 */
function withGateHeader(response: NextResponse): NextResponse {
  response.headers.set('x-kloyya-gate', describeAllowlist());
  return response;
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
        user?: { email?: string; isEmailVerified?: boolean; hasCompletedOnboarding?: boolean };
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

  return decide(request, state, NextResponse.next());
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
