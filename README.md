# Kloyya

An AI chief of staff for your work: connect your tools, and Kloyya reads across
them to answer questions (with citations), surface what matters, draft on your
behalf, and keep your documents searchable.

## Architecture

One Next.js 15 app, deployed on Vercel, backed by Supabase.

```
Users
  │
  ▼
Vercel — Next.js App Router
  ├── app/**              UI (React 19, client + server components)
  ├── app/api/v1/**       Route Handlers = the API (KAS JSON envelope)
  ├── server/**           the backend engine (services, integrations, AI, auth glue)
  └── middleware.ts       route gating on the Supabase session
  │
  ▼
Supabase
  ├── PostgreSQL          Drizzle schema + migrations; RLS tenant isolation
  ├── Auth                email/password + 6-digit email-OTP verification
  └── Storage             uploaded document bytes (private bucket)
```

Monorepo (pnpm + Turborepo):

| Package | What |
|---|---|
| `apps/web` | the whole app — UI, API route handlers (`app/api/v1`), and the server engine (`server/`) |
| `packages/core` | framework-free domain: types, the KAS contract, permissions, entitlements |
| `packages/db` | Drizzle schema, migrations, and `withTenantScope` (RLS via `SET LOCAL ROLE app_tenant` + a per-request GUC) |
| `packages/config` | shared TypeScript config |

**Tenant isolation** is enforced by Postgres RLS, not app diligence: every
DB-backed service runs inside `withTenantScope`, and identity is resolved
server-side from the Supabase JWT — never from client input.

**The mock↔real seam.** `apps/web/services/index.ts` is the single swap point:
with `NEXT_PUBLIC_USE_REAL_API` unset, the app runs on in-memory mock services
(the whole product is drivable with no backend); set it to `true` and the same
components talk to the real Route Handlers. Nothing above the service layer
changes between the two.

## Local development

```bash
pnpm install
# Mock mode — no backend needed:
pnpm --filter @kloyya/web dev            # http://localhost:3000

# Real backend: copy .env.example → apps/web/.env.local, fill it in, then:
pnpm --filter @kloyya/db migrate         # apply schema to your Supabase project
pnpm --filter @kloyya/web dev
```

The mock login screen shows a demo account; real mode uses Supabase Auth.

## Quality gates

```bash
pnpm typecheck     # tsc across every package
pnpm lint          # eslint (KFA layering rules enforced)
pnpm test          # vitest — two projects in apps/web:
                   #   ui     (jsdom) components, hooks, mock services
                   #   server (node)  route handlers + engine over in-memory PGLite
pnpm build         # next build (also compiles every /api/v1 route)
```

The `server` test project boots an in-memory Postgres (PGLite), replays the real
migrations, and exercises the route handlers with a fabricated identity — so the
API is fully tested with no Supabase and no network.

## Deployment

See [DEPLOY.md](./DEPLOY.md) — Vercel + Supabase, env vars, the Supabase
dashboard checklist, and the smoke test.
