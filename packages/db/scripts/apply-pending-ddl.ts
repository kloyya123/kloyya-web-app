/**
 * Apply migrations 0018-0022 as ONE atomic transaction.
 *
 * WHY this exists alongside the normal migrator: the bookkeeping rows for these
 * five were inserted manually (via the dashboard) after the DDL half failed, so
 * drizzle believes they are applied and will skip them — while the tables do not
 * actually exist. This applies just their SQL, leaving the (already correct)
 * bookkeeping alone, which makes the two agree again.
 *
 * All-or-nothing: a dropped connection rolls back with no partial state, so it
 * is safe to re-run until it succeeds. Delete after launch.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

// 0018 is deliberately ABSENT. Its `GRANT app_tenant TO CURRENT_USER WITH SET
// TRUE` kills the backend connection on Supabase (granting a role to the
// session's own user), which is what defeated every previous attempt — the
// migrator always started there. The grant is already in place on this database
// (verified: pg_auth_members.set_option = true), so replaying it is a no-op.
const MIGRATIONS = [
  '0019_real_retro_girl',
  '0020_tasks_projects_rls',
  '0021_foamy_daimon_hellstrom',
  '0022_bent_malcolm_colcord',
];

async function main() {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set');
  const dir = join(process.cwd(), 'drizzle');

  const statements: { tag: string; sql: string }[] = [];
  for (const tag of MIGRATIONS) {
    const text = readFileSync(join(dir, `${tag}.sql`), 'utf8');
    for (const chunk of text.split('--> statement-breakpoint')) {
      const trimmed = chunk.trim();
      if (trimmed.length > 0) statements.push({ tag, sql: trimmed });
    }
  }
  console.log(`applying ${statements.length} statements from ${MIGRATIONS.length} migrations…`);

  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 15 });
  try {
    await sql.begin(async (tx) => {
      for (const [i, s] of statements.entries()) {
        const preview = s.sql.replace(/\s+/g, ' ').slice(0, 60);
        process.stdout.write(`  [${i + 1}/${statements.length}] ${s.tag}: ${preview}… `);
        await tx.unsafe(s.sql);
        process.stdout.write('ok\n');
      }
    });
    console.log('\nCOMMITTED — all statements applied.');
  } finally {
    await sql.end({ timeout: 10 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('\nFAILED (rolled back, safe to retry):', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
