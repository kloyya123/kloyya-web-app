import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { decide } from './middleware';

/**
 * The routing gate, with the landing page and the product on one domain.
 *
 * That merge means `/` is the one route a stranger may see, which makes this the
 * highest-consequence branch in the file: too narrow and the marketing page is
 * unreachable, too broad and the whole product is. The tests below pin both
 * edges, because the broad failure is silent — every path starts with '/', so a
 * prefix match on ROOT would hand out the dashboard and nothing would look wrong
 * until a stranger opened one.
 */
// `allowed: true` everywhere below except the dedicated allowlist tests: these
// fixtures exist to pin verified/onboarded behaviour, and defaulting to "on the
// list" keeps that the case without every one of them re-litigating the gate.
const ANON = { authed: false, verified: false, onboarded: false, allowed: true };
const READY = { authed: true, verified: true, onboarded: true, allowed: true };

/** `decide` at `path`, returning the Location header (null when it passes through). */
function go(path: string, state: typeof ANON): string | null {
  const request = new NextRequest(new URL(`https://kloyya.com${path}`));
  const response = decide(request, state, NextResponse.next());
  const location = response.headers.get('location');
  if (!location) return null;
  const url = new URL(location);
  // .hash included: the allowlist gate redirects to /#waitlist, and dropping
  // the fragment here would make that redirect indistinguishable from a plain
  // '/' in every assertion below.
  return url.pathname + url.search + url.hash;
}

describe('the landing page is public', () => {
  it('shows a stranger the marketing page at /', () => {
    expect(go('/', ANON)).toBeNull();
  });

  it('still sends a stranger away from everything else', () => {
    // The point of the previous test is that `/` is special — not that the gate
    // has been relaxed. If this ever passes through, the app is wide open.
    expect(go('/dashboard', ANON)).toBe('/login?next=%2Fdashboard');
    expect(go('/settings', ANON)).toBe('/login?next=%2Fsettings');
    expect(go('/inbox', ANON)).toBe('/login?next=%2Finbox');
  });

  it('keeps the auth screens reachable', () => {
    for (const path of ['/login', '/signup', '/forgot-password']) {
      expect(go(path, ANON), path).toBeNull();
    }
  });
});

describe('a signed-in user can still read the marketing page', () => {
  it('does NOT forward them away from /', () => {
    // kloyya.com is the company's front door, not just the logged-out state.
    // Forwarding here hid pricing and the FAQ from existing customers, and made
    // a shared kloyya.com link open the recipient's own dashboard.
    expect(go('/', READY)).toBeNull();
  });

  it('leaves the auth screens reachable too', () => {
    // These used to forward to /dashboard. That turned the landing page's own
    // "Log in" and "Sign up" buttons into a trapdoor for anyone holding a stale
    // session — click Sign up, land on a dashboard, with nothing explaining why.
    expect(go('/login', READY)).toBeNull();
    expect(go('/signup', READY)).toBeNull();
  });

  it('still moves them off the provisioning screens', () => {
    // The distinction: /login is a page you may look at; /verify-email is a step
    // in a flow this account has already finished.
    expect(go('/verify-email', READY)).toBe('/dashboard');
  });

  it('leaves them alone inside the product', () => {
    expect(go('/dashboard', READY)).toBeNull();
  });
});

describe('the reset-password screen is exempt in both directions', () => {
  it('works with no session, so the emailed link is never a dead end', () => {
    expect(go('/reset-password', ANON)).toBeNull();
  });

  it('works with the recovery session Supabase creates from the link', () => {
    // Without this exemption an authenticated visitor is bounced to /dashboard,
    // past the one screen they followed the link to reach.
    expect(go('/reset-password', READY)).toBeNull();
  });
});

describe('the dashboard is unreachable until sign-up or log-in is finished', () => {
  /**
   * Stated as its own case because it is a product requirement, not an
   * implementation detail: nobody sees the dashboard until they have actually
   * completed the whole path. Each stage below is a different half-finished
   * account, and none of them get through.
   */
  const stages = [
    { name: 'never signed in', state: ANON, sentTo: '/login?next=%2Fdashboard' },
    {
      name: 'signed up but has not entered the emailed code',
      state: { authed: true, verified: false, onboarded: false, allowed: true },
      sentTo: '/verify-email',
    },
    {
      name: 'verified but has not finished onboarding',
      state: { authed: true, verified: true, onboarded: false, allowed: true },
      sentTo: '/onboarding',
    },
  ];

  for (const { name, state, sentTo } of stages) {
    it(`turns away a visitor who ${name}`, () => {
      expect(go('/dashboard', state)).toBe(sentTo);
    });
  }

  it('lets a fully provisioned account through', () => {
    expect(go('/dashboard', READY)).toBeNull();
  });
});

describe('the allowlist gate', () => {
  // A real account, real session, just not on the list — this is the state
  // isBetaAllowed() itself is unit-tested against in beta-access.test.ts. Here
  // the question is purely what the gate DOES with that answer.
  const DISALLOWED = { authed: true, verified: true, onboarded: true, allowed: false };

  it('sends a disallowed account to the waitlist, not the dashboard', () => {
    expect(go('/dashboard', DISALLOWED)).toBe('/#waitlist');
  });

  it('checked before verification or onboarding — no point walking someone through the wizard first', () => {
    const midway = { authed: true, verified: false, onboarded: false, allowed: false };
    expect(go('/verify-email', midway)).toBe('/#waitlist');
    expect(go('/onboarding', midway)).toBe('/#waitlist');
  });

  it('still lets a disallowed account read the marketing page', () => {
    // The whole point of routing them here rather than a dead end: `/` is where
    // the waitlist actually lives.
    expect(go('/', DISALLOWED)).toBeNull();
  });

  it('never blocks an allowed account', () => {
    expect(go('/dashboard', READY)).toBeNull();
  });
});

describe('provisioning still funnels forward', () => {
  it('holds an unverified user at the code screen', () => {
    const unverified = { authed: true, verified: false, onboarded: false, allowed: true };
    expect(go('/dashboard', unverified)).toBe('/verify-email');
    expect(go('/verify-email', unverified)).toBeNull();
  });

  it('lets an un-onboarded user reach workspace-init, not just /onboarding', () => {
    // The Continue button bug: workspace-init runs after the wizard, and the
    // `onboarded` stamp is best-effort, so gating on it alone looped the user
    // back to the start of the wizard they had just finished.
    const midway = { authed: true, verified: true, onboarded: false, allowed: true };
    expect(go('/workspace-init', midway)).toBeNull();
    expect(go('/onboarding', midway)).toBeNull();
    expect(go('/dashboard', midway)).toBe('/onboarding');
  });
});
