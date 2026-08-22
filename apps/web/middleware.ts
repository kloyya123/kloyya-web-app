import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { describeAllowlist, isBetaAllowed } from '@/lib/beta-access';
import { safeRedirect } from '@/lib/safe-redirect';
import { SESSION_COOKIE_NAME } from '@/services/auth/session-store';


const USE_REAL_API = process.env['NEXT_PUBLIC_USE_REAL_API'] === 'true';

/** Where the marketing site's own waitlist section lives, for disallowed accounts. */
const MARKETING_WAITLIST_URL = 'https://kloyya.com/#waitlist';

const ROOT = '/';
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  // The password-recovery email link lands here before any session exists —
  // see app/auth/confirm/route.ts, which is what actually establishes one.
  '/auth/confirm',
];
/** Reachable while authenticated but not yet fully provisioned. */
const PROVISIONING_ROUTES = ['/verify-email', '/onboarding', '/workspace-init'];


const RESET_PASSWORD = '/reset-password';

interface AuthState {
  authed: boolean;
  verified: boolean;
  onboarded: boolean;
  /** On the access allowlist. See lib/beta-access.ts. */
  allowed: boolean;
}


export function decide(request: NextRequest, state: AuthState, carry: NextResponse): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isProvisioning = PROVISIONING_ROUTES.some((route) => pathname.startsWith(route));

  const redirect = (to: URL) => {
    const res = NextResponse.redirect(to);
    for (const cookie of carry.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  // The reset screen is exempt from the whole tree — see RESET_PASSWORD above.
  if (pathname.startsWith(RESET_PASSWORD)) return carry;

  if (!state.authed) {
    if (isPublic) return carry;
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return redirect(login);
  }


  if (!state.allowed) {
    if (pathname === ROOT) return carry;
    return redirect(new URL(MARKETING_WAITLIST_URL));
  }

  // Authenticated but unverified: the only way forward is the code.
  if (!state.verified) {
    return pathname.startsWith('/verify-email') ? carry : redirect(new URL('/verify-email', request.url));
  }


  if (!state.onboarded) {
    const movingForward =
      pathname.startsWith('/onboarding') || pathname.startsWith('/workspace-init');
    return movingForward ? carry : redirect(new URL('/onboarding', request.url));
  }


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

function maintenanceResponse(): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kloyya — Down for maintenance</title>
<style>
  body { font-family: system-ui, sans-serif; background: #fafafa; color: #1a1a1a;
    display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
  main { max-width: 28rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { color: #555; line-height: 1.5; }
</style></head>
<body><main>
  <h1>Kloyya is down for maintenance</h1>
  <p>We&rsquo;re making a quick fix. This should only take a few minutes — try again shortly.</p>
</main></body></html>`,
    {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '120' },
    },
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (process.env['MAINTENANCE_MODE'] === 'true') return maintenanceResponse();
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
        // Plus de réassignation `response = NextResponse.next()` qui écrasait les en-têtes/cookies.
        // `as any` résout le conflit de type entre CookieOptions (Supabase) et ResponseCookie (Next.js).
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as any);
          }
        },
      },
    },
  );


  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    console.error('[middleware] supabase.auth.getUser() failed — treating request as unauthenticated', error);
  }

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

  return withGateHeader(decide(request, state, NextResponse.next()));
}

export const config = {

  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
