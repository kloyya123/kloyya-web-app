import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/**
 * The shared database client.
 *
 * One postgres.js connection per process, cached on globalThis so hot-reload
 * (tsx watch / Next dev) doesn't open a new pool on every reload and exhaust
 * Supabase's connection limit. The API and worker both import `db` from here.
 *
 * `prepare: false` is required: the app connects through Supabase's transaction
 * pooler (pgbouncer), which does not support prepared statements.
 *
 * This is the RAW client — it bypasses RLS when connecting as service_role.
 * Phase 5 layers tenant scoping on top; callers do not use `db` for tenant data
 * without going through that scope.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — the database client cannot connect.');
}

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const sql = globalForDb.sql ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== 'production') {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema, casing: 'snake_case' });
