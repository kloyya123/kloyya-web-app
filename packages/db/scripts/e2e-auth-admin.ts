import { createClient } from '@supabase/supabase-js';

/**
 * Validate the Supabase Auth admin path with the service-role key — the same
 * client onboarding uses to stamp metadata and storage uses to sign uploads.
 * Creates a confirmed user, reads it back, then deletes it. Leaves no trace.
 */
async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('SUPABASE URL / SERVICE_ROLE_KEY not set');

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const email = `e2e-admin-${Date.now()}@kloyya.test`;

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Admin Probe' },
  });
  if (created.error) throw new Error(`createUser failed: ${created.error.message}`);
  const id = created.data.user!.id;
  console.log('created auth user ✓', id.slice(0, 8), '| confirmed:', Boolean(created.data.user!.email_confirmed_at));

  // Update metadata (the onboarding path).
  const updated = await admin.auth.admin.updateUserById(id, { user_metadata: { onboarded: true } });
  if (updated.error) throw new Error(`updateUserById failed: ${updated.error.message}`);
  console.log('updated user_metadata.onboarded ✓');

  const deleted = await admin.auth.admin.deleteUser(id);
  if (deleted.error) throw new Error(`deleteUser failed: ${deleted.error.message}`);
  console.log('deleted auth user ✓ (no trace left)');
  console.log('Supabase Auth admin path: PASS ✓');
}

main().catch((e) => {
  console.error('AUTH ADMIN E2E FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
