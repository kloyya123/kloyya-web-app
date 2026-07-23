import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Stamp `onboarded: true` into the caller's Supabase user metadata.
 *
 * The middleware reads this claim to decide whether to let a request through to
 * the dashboard, so it can gate without a database call. Best-effort: the
 * database already recorded onboarding completion (the source of truth), and the
 * client refreshes its session after onboarding, so a metadata write that fails
 * is a degraded-but-safe state, not a broken onboarding.
 *
 * A no-op when the service-role key isn't configured (tests, local mock),
 * because there is no Supabase project to write to.
 */
export async function markOnboarded(userId: string): Promise<void> {
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(userId, { user_metadata: { onboarded: true } });
  } catch (error) {
    console.warn('[onboarding] could not stamp onboarded metadata', error);
  }
}

/** Mirror the display name into Supabase user metadata (JWT freshness). */
export async function syncMetadataName(userId: string, fullName: string): Promise<void> {
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } });
  } catch {
    // Non-fatal: users.full_name is canonical; metadata is a convenience copy.
  }
}
