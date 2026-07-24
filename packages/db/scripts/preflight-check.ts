/**
 * Read-only pre-migration preflight. Confirms the remote DB has NONE of the
 * artifacts migrations 0018-0022 create, so applying them (via the dashboard or
 * CLI) can't fail on "already exists". Mutates nothing. Delete after launch.
 */
import postgres from 'postgres';

async function main() {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    const enums = await sql<{ typname: string }[]>`
      select typname from pg_type
      where typname in ('priority_level','project_status','task_status')`;
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('tasks','projects','rate_limits')`;
    const col = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='user_preferences' and column_name='ai_drafting_enabled'`;
    const policies = await sql<{ policyname: string }[]>`
      select policyname from pg_policies
      where tablename in ('tasks','projects','rate_limits')`;
    const appTenantCanSet = await sql<{ rolname: string }[]>`
      select r.rolname from pg_auth_members m
      join pg_roles r on r.oid = m.roleid
      join pg_roles g on g.oid = m.member
      where r.rolname = 'app_tenant' and m.set_option = true`;
    const applied = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations`.catch(() => [{ count: 'n/a' }]);

    console.log('applied migration rows :', applied[0]?.count);
    console.log('0019 enums present     :', enums.map((e) => e.typname).join(', ') || 'NONE (good)');
    console.log('0019/0022 tables       :', tables.map((t) => t.table_name).join(', ') || 'NONE (good)');
    console.log('0021 column present    :', col.length ? 'YES (would conflict!)' : 'NONE (good)');
    console.log('0020 policies present  :', policies.map((p) => p.policyname).join(', ') || 'NONE (good)');
    console.log('0018 app_tenant WITH SET:', appTenantCanSet.length ? 'ALREADY GRANTED' : 'not yet (0018 will grant)');
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('PREFLIGHT FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
