/**
 * Read-only diagnostic: look for sessions that could block DDL — idle-in-
 * transaction backends holding locks, long-running queries, and any lock waits.
 * Mutates nothing. Delete after launch.
 */
import postgres from 'postgres';

async function main() {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set');
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    const activity = await sql<
      { pid: number; state: string; wait: string | null; secs: number | null; q: string }[]
    >`
      select pid,
             state,
             wait_event_type as wait,
             extract(epoch from (now() - state_change))::int as secs,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 80) as q
      from pg_stat_activity
      where datname = current_database()
        and pid <> pg_backend_pid()
        and state is not null
      order by secs desc nulls last`;

    console.log('=== active/idle sessions (excl. this one) ===');
    if (activity.length === 0) console.log('  none');
    for (const a of activity) {
      console.log(
        `  pid ${a.pid} | ${a.state} | wait=${a.wait ?? '-'} | ${a.secs ?? '?'}s | ${a.q}`,
      );
    }

    const idleInTx = activity.filter((a) => a.state === 'idle in transaction');
    console.log(`\nidle-in-transaction sessions: ${idleInTx.length}`);
    if (idleInTx.length > 0) {
      console.log('  -> these can hold locks that block DDL. PIDs:', idleInTx.map((a) => a.pid).join(', '));
    }

    const blocked = await sql<{ blocked_pid: number; blocking_pid: number }[]>`
      select pid as blocked_pid, unnest(pg_blocking_pids(pid)) as blocking_pid
      from pg_stat_activity
      where cardinality(pg_blocking_pids(pid)) > 0`;
    console.log(`\nlock-blocking relationships: ${blocked.length}`);
    for (const b of blocked) console.log(`  pid ${b.blocked_pid} blocked by ${b.blocking_pid}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('DIAGNOSE FAILED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
