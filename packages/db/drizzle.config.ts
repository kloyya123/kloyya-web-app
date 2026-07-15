import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration.
 *
 * `generate` (schema → SQL migration files) runs entirely offline — no database
 * connection — so migrations can be authored before credentials exist. Only
 * `migrate`/`push`/`studio` connect, and they use DIRECT_URL (Supabase session
 * pooler, port 5432), because migrations need a direct link, not the pgbouncer
 * transaction pooler the app runs on.
 */
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? '',
  },
  verbose: true,
  strict: true,
});
