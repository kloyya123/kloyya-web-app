# Deploying Kloyya (private beta)

Two pieces deploy separately:

- **API** (`apps/api`) — Fastify + Better Auth, containerized via [`Dockerfile`](./Dockerfile). Runs from TypeScript source with `tsx`.
- **Web** (`apps/web`) — Next.js, deployed to **Vercel**.

Both talk to the **same Supabase project** for Postgres + Storage. Keep the database and storage on one project (see the note at the bottom).

---

## 1. Database — run migrations once (before first traffic)

Migrations use `DIRECT_URL` (the Supabase **direct** connection on port 5432, not the pooler). From your machine, with the beta `.env` in place:

```bash
pnpm --filter @kloyya/db migrate
```

Also create the Storage bucket the uploader writes to: in Supabase → **Storage → New bucket → `documents`** (private).

## 2. API — deploy to Render (or any Docker/Node host)

The repo ships a Render Blueprint ([`render.yaml`](./render.yaml)).

1. Push the repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. It reads `render.yaml` and creates the `kloyya-api` web service.
3. Fill in the env vars it prompts for (everything marked `sync: false`). The must-haves:

   | Var | Value |
   |-----|-------|
   | `DATABASE_URL` | Supabase **pooler** URL (app runtime) |
   | `DIRECT_URL` | Supabase **direct** URL (migrations) |
   | `BETTER_AUTH_SECRET` | a stable 32+ char secret |
   | `BETTER_AUTH_URL` | `https://<this-api-host>` |
   | `WEB_APP_URL` / `CORS_ALLOWED_ORIGINS` | `https://<your-web-host>` |
   | `RESEND_API_KEY` | required — the API refuses to boot in production without it |
   | `EMAIL_FROM` | `Kloyya <noreply@yourdomain.com>` |
   | `TOKEN_ENCRYPTION_KEY` | the connector-token encryption key |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | base origin + **service_role** key |
   | `OPENAI_API_KEY` | for Ask Kloyya |

4. Deploy. Render injects `PORT`; the app reads it. Health check is `GET /health`.

> **Any other host** (Railway, Fly, a VPS): build the `Dockerfile` (context = repo root) and run it. It listens on `$PORT` (or `4000`). No `render.yaml` needed.

## 3. Web — deploy to Vercel

1. Vercel → **New Project** → import the repo → set **Root Directory = `apps/web`**.
2. Set environment variables (Production):

   | Var | Value |
   |-----|-------|
   | `NEXT_PUBLIC_USE_REAL_API` | `true` |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<this-api-host>/v1` |
   | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | optional analytics |

   Without `NEXT_PUBLIC_USE_REAL_API=true` the site runs on **mock data** — no real
   sign-up, verification, or profiles.

3. Deploy.

## 4. Wire the three URLs together

After both hosts have URLs, confirm they agree — otherwise auth/CORS fail:

| Var | Where | Value |
|-----|-------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel (web) | `https://<api-host>/v1` |
| `BETTER_AUTH_URL` | API | `https://<api-host>` (no `/v1`) |
| `CORS_ALLOWED_ORIGINS` | API | `https://<web-host>` |

And point each OAuth connector's redirect URI (Google/Microsoft/Notion consoles **and** the matching `*_REDIRECT_URI` env var) at `https://<api-host>/v1/integrations/<provider>/callback`.

## 5. Smoke test

- `GET https://<api-host>/health` → `{"status":"ok"}`
- Open the web app → sign up → the verification code arrives by **email** (Resend), not on-screen.
- Sign in → Settings shows your real name/role → Ask Kloyya answers (or says "not configured" if `OPENAI_API_KEY` is unset).

---

### One-project rule (important)

The Postgres database (`DATABASE_URL`/`DIRECT_URL`) and Storage (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) **must be the same Supabase project**. If they diverge, a document's row lands in one project while its bytes land in another — it appears to work until the other project is paused and files vanish. Decode any `service_role` key's middle segment and confirm its `ref` matches the project in `DATABASE_URL`.
