/**
 * Audit the Supabase Storage buckets.
 *
 * The documents bucket holds whatever users upload. Two things decide whether
 * that is safe: whether the bucket is public (a public bucket means every object
 * is a guessable URL away from anyone), and whether Storage itself enforces a
 * size and type limit independently of the application.
 *
 * The app validates both, but the app is not the only thing that can write here
 * — a leaked service-role key, a future Edge Function, or a direct call all
 * bypass it. Storage-level limits are the backstop.
 *
 * Read-only.
 */

const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !serviceRoleKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
}

async function main(): Promise<void> {
  const response = await fetch(`${url}/storage/v1/bucket`, {
    headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!response.ok) {
    console.error(`Could not list buckets: ${response.status} ${await response.text()}`);
    process.exit(2);
  }

  const buckets = (await response.json()) as Bucket[];
  const problems: string[] = [];

  console.log(`\nBuckets on ${url}\n`);
  for (const bucket of buckets) {
    const size = bucket.file_size_limit
      ? `${(bucket.file_size_limit / 1024 / 1024).toFixed(0)}MB`
      : 'UNLIMITED';
    const types = bucket.allowed_mime_types?.length
      ? `${bucket.allowed_mime_types.length} allowed types`
      : 'ANY TYPE';

    console.log(`  ${bucket.name}`);
    console.log(`      public:     ${bucket.public ? 'YES' : 'no'}`);
    console.log(`      size limit: ${size}`);
    console.log(`      mime:       ${types}`);

    if (bucket.public) {
      problems.push(
        `[CRITICAL] bucket "${bucket.name}" is PUBLIC — every object is readable by anyone with the URL.`,
      );
    }
    if (!bucket.file_size_limit) {
      problems.push(
        `[HIGH] bucket "${bucket.name}" has no size limit — a single upload can be arbitrarily large.`,
      );
    }
    if (!bucket.allowed_mime_types?.length) {
      problems.push(
        `[MEDIUM] bucket "${bucket.name}" accepts any MIME type — the application allowlist is the only control.`,
      );
    }
  }

  console.log('\n=== FINDINGS ===');
  if (problems.length === 0) console.log('  none');
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('');

  process.exit(problems.some((p) => p.startsWith('[CRITICAL]') || p.startsWith('[HIGH]')) ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error('Storage audit failed:', error);
  process.exit(2);
});
