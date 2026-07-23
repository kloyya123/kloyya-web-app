import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Who is calling — the auth-provider-neutral shape the whole server works with.
 *
 * Resolved once per request from the Supabase session cookie and passed down;
 * services never touch Supabase Auth directly, which is what lets the test
 * suite hand them a fabricated identity over an in-memory database.
 */
export interface Identity {
  /** The Supabase auth user id — also the domain `users.id`. */
  id: string;
  email: string;
  /** Display name from user metadata; the domain profile's full_name wins. */
  fullName?: string | undefined;
  /** True once the address is confirmed (email_confirmed_at is set). */
  emailVerified: boolean;
}

/**
 * The production identity resolver: read the Supabase session from the request
 * cookies and validate it against the auth server.
 *
 * `getUser()` (not `getSession()`) on purpose: getSession trusts the cookie's
 * claims unverified; getUser revalidates the JWT with Supabase, which is the
 * standard for anything a server route will act on.
 */
export async function getRequestIdentity(): Promise<Identity | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const metadataName = user.user_metadata?.['full_name'];
  return {
    id: user.id,
    email: user.email,
    fullName: typeof metadataName === 'string' && metadataName.length > 0 ? metadataName : undefined,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}
