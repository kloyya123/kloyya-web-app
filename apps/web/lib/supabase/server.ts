import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * The request-scoped Supabase client for Route Handlers and Server Components.
 *
 * Reads the auth session from the request's cookies. Route handlers may also
 * *write* cookies (token refresh); Server Components cannot — the try/catch on
 * setAll is the documented @supabase/ssr pattern for sharing one factory, with
 * the middleware guaranteeing refresh happens somewhere writable.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // Safe to ignore: middleware refreshes sessions on navigation.
          }
        },
      },
    },
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — Supabase auth cannot run without it.`);
  }
  return value;
}
