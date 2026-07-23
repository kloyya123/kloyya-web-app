import postgres from 'postgres';

/**
 * Read-only probe of the remote Supabase DB: are we reachable, which migrations
 * are applied, and do the (to-be-dropped) Better Auth tables still exist. Mutates
 * nothing.
 */
async function main() {
  const url = process.env['DIRECT_URL'];
  if (!url) throw new Error('DIRECT_URL not set');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });

  try {
    const now = await sql`select now() as now, current_database() as db`;
    console.log('CONNECTED:', now[0]!['db'], '@', now[0]!['now']);

    const applied = await sql<{ hash: string; created_at: string }[]>`
      select hash, created_at from drizzle.__drizzle_migrations order by created_at
    `.catch(() => [] as { hash: string; created_at: string }[]);
    console.log('applied migrations:', applied.length);

    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `;
    const names = tables.map((t) => t.table_name);
    console.log('public tables:', names.join(', ') || '(none)');
    console.log('better-auth tables present:', {
      user: names.includes('user'),
      session: names.includes('session'),
      account: names.includes('account'),
      verification: names.includes('verification'),
    });
    console.log('users.full_name / users.email present:', await columnsPresent(sql));

    const role = await sql<{ rolname: string }[]>`select rolname from pg_roles where rolname = 'app_tenant'`;
    console.log('app_tenant role present:', role.length > 0);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function columnsPresent(sql: postgres.Sql) {
  const cols = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
  `;
  const names = cols.map((c) => c.column_name);
  return { full_name: names.includes('full_name'), email: names.includes('email') };
}

main().catch((error) => {
  console.error('PROBE FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
