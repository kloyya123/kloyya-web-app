/**
 * Production readiness check — the live-infrastructure half.
 *
 * Proves against the REAL Supabase project that the four things the app cannot
 * start without actually work: Postgres connectivity, the full migration set,
 * Auth (admin API), and Storage (the documents bucket). RLS is covered by
 * e2e-rls.ts, which is run alongside this.
 *
 * Read-only apart from the Auth check, which creates and immediately deletes one
 * throwaway user. Delete this script after launch.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

async function main() {
  const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set');

  // --- Postgres connectivity -------------------------------------------------
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 10, connect_timeout: 15 });
  try {
    const [{ now }] = await sql<{ now: Date }[]>`select now() as now`;
    add('PostgreSQL connectivity', true, `connected (${now.toISOString()})`);

    // --- Migrations: applied count vs journal --------------------------------
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    const [{ count }] = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations`;
    const expected = journal.entries.length;
    const applied = Number(count);
    add(
      'Migrations applied',
      applied === expected,
      `${applied}/${expected} recorded${applied === expected ? '' : ' — PENDING MIGRATIONS'}`,
    );

    // --- 0018-0022 artifacts actually present --------------------------------
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('tasks','projects','rate_limits')`;
    const names = tables.map((t) => t.table_name).sort();
    add('0019/0022 tables exist', names.length === 3, names.join(', ') || 'MISSING');

    const policies = await sql<{ policyname: string }[]>`
      select policyname from pg_policies where tablename in ('tasks','projects')`;
    add('0020 RLS policies exist', policies.length === 2, policies.map((p) => p.policyname).join(', ') || 'MISSING');

    const col = await sql<{ c: string }[]>`
      select column_name as c from information_schema.columns
      where table_schema='public' and table_name='user_preferences' and column_name='ai_drafting_enabled'`;
    add('0021 column exists', col.length === 1, col.length ? 'ai_drafting_enabled' : 'MISSING');

    const grant = await sql<{ r: string }[]>`
      select r.rolname as r from pg_auth_members m
      join pg_roles r on r.oid = m.roleid
      where r.rolname='app_tenant' and m.set_option = true`;
    add('0018 app_tenant SET grant', grant.length > 0, grant.length ? 'granted' : 'MISSING — tenant scoping will fail');

    // --- Every tenant table has RLS forced -----------------------------------
    const unforced = await sql<{ relname: string }[]>`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname='public' and c.relkind='r'
        and c.relname in ('tasks','projects','documents','drafts','feedback','connections','sync_records','ask_usage')
        and not c.relforcerowsecurity`;
    add(
      'RLS forced on tenant tables',
      unforced.length === 0,
      unforced.length === 0 ? 'all forced' : `NOT forced: ${unforced.map((u) => u.relname).join(', ')}`,
    );
  } finally {
    await sql.end({ timeout: 10 }).catch(() => {});
  }

  // --- Storage ---------------------------------------------------------------
  if (supabaseUrl && serviceKey) {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const list = (await res.json()) as { name: string; public: boolean }[];
    const docs = Array.isArray(list) ? list.find((b) => b.name === 'documents') : undefined;
    add(
      'Storage: documents bucket',
      Boolean(docs) && docs?.public === false,
      docs ? `exists (private=${!docs.public})` : 'MISSING — uploads will fail',
    );
  } else {
    add('Storage: documents bucket', false, 'SUPABASE env vars missing');
  }

  // --- Auth (admin API round-trip) -------------------------------------------
  if (supabaseUrl && serviceKey) {
    const email = `readiness-${Date.now()}@kloyya.test`;
    const create = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Readiness!2026x', email_confirm: true }),
    });
    const created = (await create.json()) as { id?: string; msg?: string };
    if (create.ok && created.id) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${created.id}`, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      add('Supabase Auth (admin API)', true, 'created + deleted a test user');
    } else {
      add('Supabase Auth (admin API)', false, `HTTP ${create.status}: ${created.msg ?? 'failed'}`);
    }
  } else {
    add('Supabase Auth (admin API)', false, 'SUPABASE env vars missing');
  }

  // --- Anon key sanity (what the browser will use) ---------------------------
  if (supabaseUrl && anonKey) {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: anonKey } });
    add('Supabase anon key valid', res.ok, res.ok ? 'auth settings reachable' : `HTTP ${res.status}`);
  } else {
    add('Supabase anon key valid', false, 'NEXT_PUBLIC_SUPABASE_ANON_KEY missing');
  }

  // --- Report ----------------------------------------------------------------
  const width = Math.max(...checks.map((c) => c.name.length));
  console.log('');
  for (const c of checks) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name.padEnd(width)}  ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('READINESS CHECK ERRORED:', e instanceof Error ? e.message.split('\n')[0] : e);
  process.exit(1);
});
