import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * The landing point for every Supabase auth email link that isn't a typed
 * OTP code — today, just password recovery.
 *
 * Signup uses a typed 6-digit code (see verify-email-form.tsx), so it never
 * needs this. Recovery has no code-entry equivalent in Supabase's UI, so the
 * link has to go somewhere — and until this route existed, "somewhere" was an
 * implicit mechanic: `@supabase/ssr`'s browser client auto-detects a `code`
 * param in the URL and exchanges it for a session the first time anything
 * calls `.auth.*`. That only works when the click happens in the SAME
 * browser that submitted the forgot-password form — a link opened from a
 * phone's mail app, or pre-fetched by corporate email scanning, silently
 * fails the exchange, and the reset form then reports a generic "link no
 * longer valid" for what is actually a cross-device PKCE mismatch.
 *
 * `token_hash` + `verifyOtp` has no such requirement: Supabase's email
 * template must be changed to build the link from `{{ .TokenHash }}` rather
 * than `{{ .ConfirmationURL }}` for this to be what actually fires — see the
 * dashboard template. The exchange happens here, server-side, once, and the
 * session cookie is set before the visitor ever sees a page.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeRedirect(searchParams.get('next'), '/reset-password');

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Expired, already used, or malformed — never a dead end. Forgot-password
  // is where a person can ask for a fresh one.
  const fallback = new URL('/forgot-password', origin);
  fallback.searchParams.set('status', 'expired');
  return NextResponse.redirect(fallback);
}
