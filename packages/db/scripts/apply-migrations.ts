/**
 * Resilient migration applier for an unstable link to Supabase.
 *
 * `drizzle-kit migrate` wraps ALL pending migrations in one long transaction,
 * which a flaky connection drops before it commits — nothing lands. This applies
 * migrations one at a time, each as a SINGLE simple-query round-trip
 * (`BEGIN; …; COMMIT;`) over a fresh short-lived connection, so a dropped socket
 * costs at most one retry instead of the whole run. It records drizzle's exact
 * bookkeeping (hash = sha256 of the file, created_at = the journal's `when`), so
 * a later `drizzle-kit migrate`/`check` treats these as already applied.
 *
 * Run `pnpm --filter @kloyya/db migrate:resilient`. That invokes this file as a
 * SUPERVISOR that repeatedly spawns a fresh child (`--one`) of itself; each child
 * applies a single migration and exits, so postgres.js's uncatchable dead-socket
 * crash only ever loses one child, never the run. The supervisor stops when a
 * child reports the schema is up to date.
 *
 * Prefer plain `pnpm --filter @kloyya/db migrate` when the connection is stable;
 * reach for this only when that fails to make progress.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DIRECT_URL / DATABASE_URL is not set.');
  process.exit(1);
}

const FOLDER = 'drizzle';

interface Migration {
  tag: string;
  statements: string[];
  when: number;
  hash: string;
}

function loadMigrations(): Migration[] {
  const journal = JSON.parse(readFileSync(`${FOLDER}/meta/_journal.json`, 'utf8')) as {
    entries: { tag: string; when: number }[];
  };
  return journal.entries.map((entry) => {
    const content = readFileSync(`${FOLDER}/${entry.tag}.sql`, 'utf8');
    return {
      tag: entry.tag,
      statements: content.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean),
      when: entry.when,
      hash: createHash('sha256').update(content).digest('hex'),
    };
  });
}

function connect() {
  return postgres(connectionString!, {
    max: 1,
    idle_timeout: 15,
    connect_timeout: 8,
    prepare: false,
  });
}

async function withConnection<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = connect();
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

/** Applies at most ONE pending migration, then exits. Exit 2 = up to date. */
async function applyOne() {
  const migrations = loadMigrations();

  const lastApplied = await withConnection(async (sql) => {
    await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
    await sql`CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
    const rows = await sql<{ created_at: string | null }[]>`
      select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1`;
    return rows[0]?.created_at ? Number(rows[0].created_at) : 0;
  });

  const next = migrations.filter((m) => m.when > lastApplied).sort((a, b) => a.when - b.when)[0];
  if (!next) {
    console.log('DONE: schema is up to date.');
    process.exit(2);
  }

  // ONE round-trip: the flaky link drops during multi-statement transactions, so
  // the whole migration + its bookkeeping goes as a single simple-query string
  // (BEGIN…COMMIT is atomic on the server). hash is hex and `when` is an integer,
  // both safe to inline — there is no user input here.
  const combined = [
    'BEGIN;',
    ...next.statements.map((s) => (s.endsWith(';') ? s : `${s};`)),
    `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ('${next.hash}', ${next.when});`,
    'COMMIT;',
  ].join('\n');

  await withConnection((sql) => sql.unsafe(combined));
  console.log(`APPLIED: ${next.tag}`);
  process.exit(0);
}

/** Supervisor: spawn `--one` children until one reports up-to-date (exit 2). */
function supervise() {
  const MAX = 60;
  const scriptPath = process.argv[1]!;
  for (let i = 1; i <= MAX; i += 1) {
    // Run the child .ts through tsx's loader (the parent was launched the same way).
    const child = spawnSync(process.execPath, ['--import', 'tsx', scriptPath, '--one'], {
      stdio: 'inherit',
      env: process.env,
    });
    if (child.status === 2) {
      console.log('All migrations applied.');
      return;
    }
    if (child.status !== 0) {
      console.error(`  child failed (attempt ${i}/${MAX}) — retrying`);
    }
  }
  console.error('Gave up after too many attempts — run again when the link is stable.');
  process.exit(1);
}

if (process.argv.includes('--one')) {
  // postgres.js can throw an uncatchable dead-socket write in an async callback;
  // treat it as a failed attempt (exit 1) so the supervisor retries.
  process.on('uncaughtException', (error) => {
    console.error(`CRASH: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    process.exit(1);
  });
  applyOne().catch((error) => {
    console.error(`FAILED: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    process.exit(1);
  });
} else {
  supervise();
}
