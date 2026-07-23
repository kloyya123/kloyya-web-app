'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser Supabase client — one per tab, cached at module scope.
 *
 * `@supabase/ssr`'s browser client stores the session in cookies (not
 * localStorage), which is exactly why the server Route Handlers can read it: the
 * same httpOnly-managed cookie rides along on every same-origin fetch. There is
 * no token in JavaScript's reach.
 */
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for auth.',
    );
  }

  client = createBrowserClient(url, anonKey);
  return client;
}
