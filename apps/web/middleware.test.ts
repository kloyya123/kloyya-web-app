import { NextRequest, NextResponse } from 'next/server';
import { describe, it, expect } from 'vitest';
import { decide } from './middleware'; // Ajuste le chemin si ton fichier de test est ailleurs

const createRequest = (path: string) => 
  new NextRequest(new URL(path, 'https://app.kloyya.com'));

const ANON = { authed: false, verified: false, onboarded: false, allowed: false };
const READY = { authed: true, verified: true, onboarded: true, allowed: true };

const go = (path: string, state: typeof ANON) => {
  const req = createRequest(path);
  const res = NextResponse.next();
  const result = decide(req, state, res);
  
  if (result.status === 307 || result.status === 308) {
    const location = result.headers.get('location');
    if (!location) return null;
    const url = new URL(location, 'https://app.kloyya.com');
    return `${url.pathname}${url.search}`;
  }
  return null;
};

describe('middleware routing', () => {
  describe('unauthenticated users', () => {
    it('redirects a stranger from / to /login', () => {
      expect(go('/', ANON)).toBe('/login?next=%2F');
    });

    it('redirects a stranger from legal pages to /login', () => {
      expect(go('/privacy', ANON)).toBe('/login?next=%2Fprivacy');
      expect(go('/terms', ANON)).toBe('/login?next=%2Fterms');
    });

    it('allows access to public auth routes', () => {
      expect(go('/login', ANON)).toBeNull();
      expect(go('/signup', ANON)).toBeNull();
      expect(go('/forgot-password', ANON)).toBeNull();
    });
  });

  describe('signed-in, fully provisioned users', () => {
    it('redirects them away from / to /dashboard', () => {
      expect(go('/', READY)).toBe('/dashboard');
    });

    it('redirects them away from auth screens to /dashboard', () => {
      expect(go('/login', READY)).toBe('/dashboard');
      expect(go('/signup', READY)).toBe('/dashboard');
    });

    it('allows them to stay on the dashboard', () => {
      expect(go('/dashboard', READY)).toBeNull();
    });
    
    it('still moves them off the provisioning screens', () => {
      expect(go('/onboarding', READY)).toBe('/dashboard');
    });
  });

  describe('the allowlist gate', () => {
    it('sends a disallowed account to the waitlist, not the dashboard', () => {
      const DISALLOWED = { authed: true, verified: true, onboarded: true, allowed: false };
      expect(go('/dashboard', DISALLOWED)).toBe('https://kloyya.com/#waitlist');
    });
  });
});
