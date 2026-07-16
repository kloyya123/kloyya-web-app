/**
 * Remote schema verification — proves what is actually live in Supabase.
 *
 * Runs the same assertions as the local verifier against the real database over
 * DIRECT_URL, so "the migration exited 0" becomes "the tables, enums, RLS,
 * policies and role are demonstrably there". Read-only: it asserts, never
 * migrates.
 *
 * `exactTables` is off here — a real Supabase project legitimately carries
 * tables we didn't create, and failing on those would be noise, not signal.
 *
 * Run: pnpm --filter @kloyya/db verify:remote
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { assertSchema } from './assert-schema.js';

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  console.error('DIRECT_URL is not set — cannot verify the remote schema.');
  process.exit(1);
}

/** Host only. The connection string carries a password; it never gets printed. */
function describeTarget(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

async function main(): Promise<void> {
  const client = postgres(connectionString!, { max: 1 });
  const db = drizzle(client);

  console.log(`Verifying schema on ${describeTarget(connectionString!)}…\n`);
  // The postgres-js driver resolves execute() to the row array itself.
  await assertSchema(async (q) => (await db.execute(q)) as unknown as never[], {
    exactTables: false,
  });

  await client.end();
  console.log('\nRemote schema verified — Supabase matches the committed migrations. ✓');
}

main().catch((err) => {
  console.error('\nRemote verification FAILED:\n', err);
  process.exit(1);
});
