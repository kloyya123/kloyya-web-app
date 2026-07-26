/**
 * Attack the authenticated API surface.
 *
 * Reading `getUser()` in the source and concluding "JWTs are validated" is not
 * evidence — it is a reading of the happy path. This sends real malformed,
 * forged, and tampered credentials at a running server and asserts what actually
 * comes back.
 *
 * Every case must be refused. A 200, or any 5xx (a crash is not a refusal), is a
 * failure.
 *
 * Usage: BASE_URL=http://localhost:3000 tsx scripts/probe-auth.ts
 */
import { createHmac, randomUUID } from 'node:crypto';

const baseUrl = (process.env['BASE_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * Routes that must never answer an unauthenticated or forged caller, each with
 * a method it actually implements.
 *
 * The method matters: Next's router answers an unimplemented verb with 405
 * before the handler — and therefore before the auth guard — ever runs. Probing
 * PATCH-only /settings with GET produces a 405 that looks like a bypass but is
 * only the router declining to route. Naming the real verb keeps the result
 * about authentication.
 */
const GUARDED: { path: string; method: string; body?: unknown }[] = [
  { path: '/api/v1/me', method: 'GET' },
  { path: '/api/v1/session', method: 'GET' },
  { path: '/api/v1/tasks', method: 'GET' },
  { path: '/api/v1/documents', method: 'GET' },
  { path: '/api/v1/drafts', method: 'GET' },
  { path: '/api/v1/integrations', method: 'GET' },
  { path: '/api/v1/organization', method: 'GET' },
  { path: '/api/v1/feedback/summary', method: 'GET' },
  { path: '/api/v1/settings', method: 'PATCH', body: { fullName: 'probe' } },
  { path: '/api/v1/onboarding', method: 'POST', body: { role: 'probe' } },
  { path: '/api/v1/ask', method: 'POST', body: { question: 'probe' } },
  { path: '/api/v1/me/active-workspace', method: 'PATCH', body: { workspaceId: randomUUID() } },
];

interface Case {
  name: string;
  headers: Record<string, string>;
}

function base64url(input: object | string): string {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(raw).toString('base64url');
}

/** A structurally valid JWT signed with a key the server does not know. */
function forgedJwt(claims: Record<string, unknown>, secret = 'attacker-controlled-secret'): string {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({
    sub: randomUUID(),
    aud: 'authenticated',
    role: 'authenticated',
    email: 'attacker@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/** A JWT claiming `alg: none` — the classic signature-stripping attack. */
function algNoneJwt(): string {
  const header = base64url({ alg: 'none', typ: 'JWT' });
  const payload = base64url({
    sub: randomUUID(),
    aud: 'authenticated',
    role: 'service_role', // privilege escalation attempt
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.`;
}

const CASES: Case[] = [
  { name: 'no credentials at all', headers: {} },
  { name: 'empty bearer token', headers: { Authorization: 'Bearer ' } },
  { name: 'garbage bearer token', headers: { Authorization: 'Bearer not-a-jwt' } },
  {
    name: 'forged JWT, valid shape, wrong signing key',
    headers: { Authorization: `Bearer ${forgedJwt({})}` },
  },
  {
    name: 'forged JWT claiming service_role',
    headers: { Authorization: `Bearer ${forgedJwt({ role: 'service_role' })}` },
  },
  {
    name: 'alg:none signature stripped, claiming service_role',
    headers: { Authorization: `Bearer ${algNoneJwt()}` },
  },
  {
    name: 'expired forged JWT',
    headers: {
      Authorization: `Bearer ${forgedJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })}`,
    },
  },
  {
    name: 'forged session cookie',
    headers: { Cookie: `sb-access-token=${forgedJwt({})}; sb-refresh-token=${randomUUID()}` },
  },
];

interface Failure {
  route: string;
  attack: string;
  status: number;
  body: string;
}

async function main(): Promise<void> {
  console.log(`\nAttacking ${baseUrl} — every case below must be refused\n`);

  const failures: Failure[] = [];
  let checked = 0;

  for (const attack of CASES) {
    const statuses: number[] = [];
    for (const route of GUARDED) {
      checked += 1;
      let status: number;
      let body: string;
      try {
        const response = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: {
            ...attack.headers,
            Accept: 'application/json',
            ...(route.body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(route.body ? { body: JSON.stringify(route.body) } : {}),
          redirect: 'manual',
        });
        status = response.status;
        body = (await response.text()).slice(0, 160);
      } catch (error) {
        status = -1;
        body = String(error);
      }
      statuses.push(status);

      // 401/403 is the correct refusal. 3xx is the middleware redirecting an
      // unauthenticated browser to /login, which is also a refusal.
      const refused = status === 401 || status === 403 || (status >= 300 && status < 400);
      if (!refused) {
        failures.push({ route: `${route.method} ${route.path}`, attack: attack.name, status, body });
      }
    }
    const unique = [...new Set(statuses)].sort((a, b) => a - b).join(', ');
    console.log(`  ${attack.name.padEnd(46)} → ${unique}`);
  }

  console.log(`\n${checked} request(s) across ${GUARDED.length} routes.`);
  console.log('\n=== FINDINGS ===');
  if (failures.length === 0) {
    console.log('  none — every forged, missing, and tampered credential was refused.\n');
    process.exit(0);
  }
  for (const failure of failures) {
    console.log(`  [CRITICAL] ${failure.route} accepted "${failure.attack}" → ${failure.status}`);
    console.log(`             ${failure.body}`);
  }
  console.log('');
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error('Probe failed:', error);
  process.exit(2);
});
