/**
 * Live security audit of the database.
 *
 * Reads the actual catalog rather than the migration files: a migration that was
 * written is not a migration that was applied, and the only thing that protects
 * production is what is running in production. Reports, and exits non-zero, on:
 *
 *   - a table with RLS enabled but not FORCED (the owner is then exempt)
 *   - a table with RLS enabled and no policy (silently denies everything, which
 *     is safe but usually a mistake)
 *   - a table with no RLS at all
 *   - a policy granted to PUBLIC rather than to app_tenant
 *   - a policy with a permissive USING (true) / no WITH CHECK on writes
 *   - privileges granted to anon / authenticated on application tables
 *   - foreign keys with no supporting index (the classic slow-DELETE trap)
 *
 * Read-only. Safe to run against production.
 */
import postgres from 'postgres';

const connectionString = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('Set DIRECT_URL or DATABASE_URL.');
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  area: string;
  detail: string;
}

const findings: Finding[] = [];
const note = (severity: Finding['severity'], area: string, detail: string) =>
  findings.push({ severity, area, detail });

/**
 * Tables that are deliberately owner-only, with the reason.
 *
 * These carry no tenant column and are written by infrastructure that runs
 * before — or entirely outside — a tenant context, so they cannot have an
 * `app_tenant` policy and must not be FORCED (forcing a table with no policies
 * locks out its owner, which here is the application itself).
 *
 * RLS stays ENABLED so that anon and authenticated are still denied by default,
 * and the grant revocation in migration 0023 means neither role can reach them
 * over PostgREST regardless. Listing them here keeps the audit honest: a real
 * regression on any other table still fails the run, instead of being lost in a
 * finding everyone has learned to ignore.
 */
const OWNER_ONLY_TABLES: Record<string, string> = {
  rate_limits:
    'no tenant column; written by the request limiter before tenant scope is resolved',
};

async function main(): Promise<void> {
  // ---------------------------------------------------------------- RLS state
  const tables = await sql<
    { table_name: string; rls_enabled: boolean; rls_forced: boolean; policy_count: number }[]
  >`
    SELECT c.relname                       AS table_name,
           c.relrowsecurity                AS rls_enabled,
           c.relforcerowsecurity           AS rls_forced,
           (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relname NOT IN ('__drizzle_migrations')
     ORDER BY c.relname
  `;

  console.log('\n=== ROW LEVEL SECURITY ===');
  for (const table of tables) {
    const ownerOnlyReason = OWNER_ONLY_TABLES[table.table_name];
    const flags = [
      table.rls_enabled ? 'enabled' : 'DISABLED',
      table.rls_forced ? 'forced' : 'not forced',
      `${table.policy_count} policies`,
      ownerOnlyReason ? '(owner-only by design)' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    console.log(`  ${table.table_name.padEnd(24)} ${flags}`);

    // RLS off is unconditionally wrong: anon and authenticated read every row.
    if (!table.rls_enabled) {
      note('CRITICAL', 'RLS', `${table.table_name}: RLS is not enabled — every row is readable.`);
      continue;
    }

    if (ownerOnlyReason) {
      // Declared infrastructure. The only thing worth checking is that it has
      // not quietly grown a policy, which would mean it now holds tenant data
      // and the exemption no longer applies.
      if (table.policy_count > 0) {
        note(
          'HIGH',
          'RLS',
          `${table.table_name}: declared owner-only (${ownerOnlyReason}) but now has ${table.policy_count} policies — the exemption in this script is out of date.`,
        );
      }
      continue;
    }

    if (!table.rls_forced) {
      note(
        'CRITICAL',
        'RLS',
        `${table.table_name}: RLS enabled but not FORCED — the table owner bypasses every policy.`,
      );
    } else if (table.policy_count === 0) {
      note(
        'MEDIUM',
        'RLS',
        `${table.table_name}: RLS forced with no policies — denies all access to app_tenant.`,
      );
    }
  }

  // ------------------------------------------------------------- policy shape
  const policies = await sql<
    {
      table_name: string;
      policy_name: string;
      roles: string[];
      command: string;
      using_expr: string | null;
      check_expr: string | null;
      permissive: string;
    }[]
  >`
    SELECT c.relname                                        AS table_name,
           p.polname                                        AS policy_name,
           COALESCE(
             ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles)),
             ARRAY['PUBLIC']
           )                                                AS roles,
           CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                         WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                         ELSE 'ALL' END                     AS command,
           pg_get_expr(p.polqual,      p.polrelid)          AS using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid)          AS check_expr,
           CASE p.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS permissive
      FROM pg_policy p
      JOIN pg_class c     ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
     ORDER BY c.relname, p.polname
  `;

  console.log('\n=== POLICIES ===');
  for (const policy of policies) {
    const roles = policy.roles.length === 0 ? ['PUBLIC'] : policy.roles;
    console.log(`  ${policy.table_name}.${policy.policy_name} [${policy.command}] → ${roles.join(', ')}`);

    if (roles.includes('PUBLIC') || roles.includes('public')) {
      note(
        'CRITICAL',
        'RLS',
        `${policy.table_name}.${policy.policy_name} applies to PUBLIC — it covers every role including anon.`,
      );
    }
    if (policy.using_expr && /^\s*true\s*$/i.test(policy.using_expr)) {
      note(
        'HIGH',
        'RLS',
        `${policy.table_name}.${policy.policy_name} has USING (true) — no row filtering at all.`,
      );
    }
    // A write policy with no WITH CHECK lets a row be written into another
    // tenant even though it could not be read back.
    const writes = policy.command === 'ALL' || policy.command === 'INSERT' || policy.command === 'UPDATE';
    if (writes && !policy.check_expr) {
      note(
        'HIGH',
        'RLS',
        `${policy.table_name}.${policy.policy_name} permits writes with no WITH CHECK — rows can be inserted into another tenant.`,
      );
    }
  }

  // -------------------------------------------------------------- grants leak
  const grants = await sql<{ grantee: string; table_name: string; privileges: string }[]>`
    SELECT grantee,
           table_name,
           string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privileges
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND grantee IN ('anon', 'authenticated', 'PUBLIC')
     GROUP BY grantee, table_name
     ORDER BY grantee, table_name
  `;

  console.log('\n=== GRANTS TO anon / authenticated / PUBLIC ===');
  if (grants.length === 0) {
    console.log('  (none — application tables are reachable only through the service role)');
  }
  for (const grant of grants) {
    console.log(`  ${grant.grantee.padEnd(15)} ${grant.table_name.padEnd(22)} ${grant.privileges}`);
    note(
      'HIGH',
      'GRANTS',
      `${grant.grantee} holds ${grant.privileges} on ${grant.table_name} — reachable directly via PostgREST with an anon key.`,
    );
  }

  // ------------------------------------------------------- unindexed FK check
  const unindexed = await sql<{ table_name: string; column_name: string; constraint_name: string }[]>`
    SELECT c.relname AS table_name,
           a.attname AS column_name,
           con.conname AS constraint_name
      FROM pg_constraint con
      JOIN pg_class c     ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
     WHERE con.contype = 'f'
       AND n.nspname = 'public'
       AND NOT EXISTS (
         SELECT 1 FROM pg_index i
          WHERE i.indrelid = con.conrelid
            AND (i.indkey::smallint[])[0] = k.attnum
       )
     ORDER BY c.relname, a.attname
  `;

  console.log('\n=== FOREIGN KEYS WITHOUT A LEADING INDEX ===');
  if (unindexed.length === 0) console.log('  (none)');
  for (const fk of unindexed) {
    console.log(`  ${fk.table_name}.${fk.column_name}  (${fk.constraint_name})`);
    note(
      'MEDIUM',
      'PERFORMANCE',
      `${fk.table_name}.${fk.column_name} is a foreign key with no supporting index — every parent DELETE or UPDATE scans this table.`,
    );
  }

  // -------------------------------------------------------- leftover artefacts
  const legacy = tables.filter((t) =>
    ['user', 'session', 'account', 'verification'].includes(t.table_name),
  );
  if (legacy.length > 0) {
    console.log('\n=== LEGACY TABLES ===');
    for (const table of legacy) {
      console.log(`  ${table.table_name}`);
      note(
        'LOW',
        'CLEANUP',
        `${table.table_name} is a Better Auth table left behind after the move to Supabase Auth — dead surface area holding stale credentials.`,
      );
    }
  }

  // -------------------------------------------------------------- the verdict
  console.log('\n=== FINDINGS ===');
  const order: Finding['severity'][] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  if (findings.length === 0) console.log('  none');
  for (const severity of order) {
    for (const finding of findings.filter((f) => f.severity === severity)) {
      console.log(`  [${finding.severity}] ${finding.area}: ${finding.detail}`);
    }
  }

  const blocking = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
  console.log(`\n${findings.length} finding(s), ${blocking} at CRITICAL or HIGH.\n`);
  await sql.end();
  process.exit(blocking > 0 ? 1 : 0);
}

main().catch(async (error: unknown) => {
  console.error('Audit failed:', error);
  await sql.end();
  process.exit(2);
});
