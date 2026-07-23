import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role Supabase client — full-power, RLS-bypassing, server-ONLY.
 *
 * Used for the few privileged operations a user session cannot perform on
 * itself: stamping `user_metadata.onboarded` at onboarding completion, storage
 * writes on the user's behalf, and signed upload URLs. The `server-only` import
 * makes any accidental client-bundle inclusion a build error, not a leak.
 */
let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin operations.',
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
