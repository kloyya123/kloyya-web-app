/**
 * Decisive DDL diagnostic.
 *
 * Evidence so far: reads work, tiny INSERTs work, but every DDL statement kills
 * the connection — from BOTH this machine and the server-side dashboard. That
 * pattern fits a broken DDL *event trigger* (Supabase ships pgrst_ddl_watch),
 * which fires on every DDL command and would crash the backend each time.
 *
 * This lists event triggers, then runs a trivial CREATE TABLE inside a
 * transaction it always rolls back — zero residue, but decisive: if a trivial
 * DDL also kills the connection, the problem is DDL itself, not size/network.
 *
 * Read-only in effect (the probe table never commits). Delete after launch.
 */
import postgres from 'postgres';

async function main() {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 });

  try {
    const triggers = await sql<
      { evtname: string; evtevent: string; evtenabled: string; fn: string; ok: boolean }[]
    >`
      select e.evtname,
             e.evtevent,
             e.evtenabled,
             n.nspname || '.' || p.proname as fn,
             (p.oid is not null) as ok
      from pg_event_trigger e
      left join pg_proc p on p.oid = e.evtfoid
      left join pg_namespace n on n.oid = p.pronamespace
      order by e.evtname`;

    console.log('=== DDL event triggers ===');
    if (triggers.length === 0) console.log('  none');
    for (const t of triggers) {
      console.log(
        `  ${t.evtname} | on ${t.evtevent} | enabled=${t.evtenabled} | fn=${t.fn ?? 'MISSING!'}`,
      );
    }

    const timeouts = await sql<{ name: string; setting: string }[]>`
      select name, setting from pg_settings
      where name in ('statement_timeout','idle_in_transaction_session_timeout','lock_timeout')`;
    console.log('\n=== timeouts on this connection ===');
    for (const t of timeouts) console.log(`  ${t.name} = ${t.setting}`);

    console.log('\n=== trivial DDL probe (always rolled back) ===');
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe('create table "_kloyya_ddl_probe" (x int)');
        throw new Error('__ROLLBACK__');
      });
      console.log('  unexpected: transaction committed');
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      if (msg === '__ROLLBACK__') {
        console.log('  DDL SUCCEEDED (then rolled back) -> DDL itself is fine.');
      } else {
        console.log(`  DDL FAILED -> ${msg}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('DIAGNOSE FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
