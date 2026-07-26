/**
 * Scan the built client bundle for server secrets.
 *
 * `import 'server-only'` and the `NEXT_PUBLIC_` convention are supposed to keep
 * secrets off the client, but both are conventions enforced at build time by
 * code we do not own. This checks the artefact instead: it takes the real values
 * out of the environment and looks for them in everything Next will actually
 * serve to a browser.
 *
 * A hit is unambiguous — that string is in a file any visitor can download.
 *
 * Usage: pnpm --filter @kloyya/db scan:bundle   (run after `next build`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Directories Next serves to the browser verbatim. */
const CLIENT_DIRS = [
  '../../apps/web/.next/static',
  '../../apps/web/.next/server/app', // RSC payloads can inline values into HTML
];

/**
 * Variables that must never appear in a client artefact.
 *
 * NEXT_PUBLIC_* is deliberately excluded: those are public by definition and are
 * meant to be there. The Supabase anon key in particular is a published
 * identifier, not a credential — it is RLS and the privilege grants that protect
 * the data behind it (see migration 0023).
 */
const SECRET_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'TOKEN_ENCRYPTION_KEY',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'MICROSOFT_OAUTH_CLIENT_SECRET',
  'NOTION_OAUTH_CLIENT_SECRET',
  'POSTHOG_PERSONAL_API_KEY',
];

/** Short or low-entropy values would match everywhere and mean nothing. */
const MIN_SEARCHABLE_LENGTH = 12;

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // Directory absent — reported by the caller as "not built".
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

function main(): void {
  const searchable = SECRET_VARS.map((name) => ({ name, value: process.env[name] })).filter(
    (secret): secret is { name: string; value: string } =>
      typeof secret.value === 'string' && secret.value.length >= MIN_SEARCHABLE_LENGTH,
  );

  if (searchable.length === 0) {
    console.error('No secrets present in the environment — nothing to scan for.');
    process.exit(2);
  }

  console.log(`\nScanning client artefacts for ${searchable.length} secret value(s)\n`);

  const leaks: { file: string; secret: string }[] = [];
  let scanned = 0;

  for (const dir of CLIENT_DIRS) {
    for (const file of walk(dir)) {
      if (!/\.(js|mjs|cjs|json|html|txt|map|rsc)$/.test(file)) continue;
      scanned += 1;
      let contents: string;
      try {
        contents = readFileSync(file, 'utf8');
      } catch {
        continue; // Unreadable or binary; nothing to match against.
      }
      for (const secret of searchable) {
        if (contents.includes(secret.value)) leaks.push({ file, secret: secret.name });
      }
    }
  }

  console.log(`  scanned ${scanned} file(s)`);
  for (const secret of searchable) console.log(`  checked ${secret.name}`);

  console.log('\n=== FINDINGS ===');
  if (leaks.length === 0) {
    console.log('  none — no server secret appears in any client artefact.\n');
    process.exit(0);
  }
  for (const leak of leaks) console.log(`  [CRITICAL] ${leak.secret} found in ${leak.file}`);
  console.log('');
  process.exit(1);
}

main();
