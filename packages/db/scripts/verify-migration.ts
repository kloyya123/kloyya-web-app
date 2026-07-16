/**
 * Local migration verification — no cloud, no credentials.
 *
 * Applies the committed Drizzle migrations to a fresh in-memory PGLite
 * (embedded Postgres) and asserts the schema landed. This is the local proof
 * that a migration is sound before it ever reaches Supabase — and the reason
 * dev doesn't need Docker (PGLite is Postgres in-process, unlike SQLite which
 * can't run this schema's enums/arrays/RLS).
 *
 * Run: pnpm --filter @kloyya/db verify:local
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { assertSchema } from './assert-schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '../drizzle');

async function main(): Promise<void> {
  const client = new PGlite(); // in-memory, discarded on exit
  const db = drizzle(client);

  console.log(`Applying migrations from ${migrationsFolder} to in-memory PGLite…\n`);
  await migrate(db, { migrationsFolder });

  // A fresh database should contain exactly our schema and nothing else.
  // The pglite driver resolves execute() to { rows, fields }.
  await assertSchema(async (q) => (await db.execute(q)).rows as never[], { exactTables: true });

  await client.close();
  console.log('\nMigration verified against PGLite — schema is sound. ✓');
}

main().catch((err) => {
  console.error('\nMigration verification FAILED:\n', err);
  process.exit(1);
});
