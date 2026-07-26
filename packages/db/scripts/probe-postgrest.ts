/**
 * Attack the PostgREST surface with the public anon key.
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the browser bundle, so it is not a
 * secret — anyone who loads the app has it. Supabase exposes every table in the
 * `public` schema over PostgREST, so the only thing standing between that key
 * and the tables is RLS. This proves whether that holds, rather than assuming it.
 *
 * Read attempts only. Nothing here writes.
 */

const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!url || !anonKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const TABLES = [
  'users',
  'organizations',
  'workspaces',
  'memberships',
  'invitations',
  'connections',
  'sync_records',
  'ask_usage',
  'rate_limits',
  'drafts',
  'documents',
  'projects',
  'tasks',
  'feedback',
  'user_preferences',
];

interface Result {
  table: string;
  status: number;
  rows: number | null;
  body: string;
}

async function probe(table: string): Promise<Result> {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
    headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` },
  });
  const body = await response.text();
  let rows: number | null = null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (Array.isArray(parsed)) rows = parsed.length;
  } catch {
    // A non-JSON body is an error page; `body` below carries the detail.
  }
  return { table, status: response.status, rows, body: body.slice(0, 120) };
}

async function main(): Promise<void> {
  console.log(`\nProbing ${url}/rest/v1/ with the ANON key\n`);

  const leaked: string[] = [];

  for (const table of TABLES) {
    const result = await probe(table);
    const exposed = result.status === 200 && (result.rows ?? 0) > 0;
    const readable = result.status === 200;

    const verdict = exposed
      ? 'LEAK — returned rows'
      : readable
        ? 'reachable, 0 rows (RLS filtering)'
        : `denied (${result.status})`;

    console.log(`  ${table.padEnd(20)} ${String(result.status).padEnd(5)} ${verdict}`);
    if (exposed) leaked.push(table);
  }

  console.log('');
  if (leaked.length > 0) {
    console.log(`CRITICAL: ${leaked.length} table(s) returned data to an anonymous caller:`);
    for (const table of leaked) console.log(`  - ${table}`);
    process.exit(1);
  }
  console.log('No table returned rows to an anonymous caller.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Probe failed:', error);
  process.exit(2);
});
