# Deploying Kloyya (private beta)

Kloyya is **one Next.js app** deployed to **Vercel**, backed by **Supabase**
(Postgres + Auth + Storage). There is no separate API server.

```
Users → Vercel (Next.js: pages + /api/v1 Route Handlers + middleware) → Supabase
                                                              (Postgres · Auth · Storage)
```

---

## 1. Supabase project (one-time)

In the Supabase dashboard for your project:

1. **Auth → Providers → Email**: enabled, "Confirm email" ON.
2. **Auth → Email Templates**:
   - **Confirm signup** → body uses `{{ .Token }}` (a 6-digit code, not a link).
   - **Reset password** → body uses `{{ .Token }}`.
3. **Auth → SMTP**: custom SMTP = Resend (`smtp.resend.com:465`, user `resend`,
   password = your `RESEND_API_KEY`, sender = your verified `EMAIL_FROM`). This is
   what actually delivers the codes.
4. **Auth → URL Configuration**: Site URL = your production Vercel URL; add
   `http://localhost:3000/**` for local dev.
5. **Auth → keep enumeration protection ON** (the sign-up flow expects it).
6. **Storage**: create a **private** bucket named `documents`.
7. **Database**: after migrations (step 2) confirm the `app_tenant` role and the
   per-table RLS policies exist (`select * from pg_policies;`).

## 2. Database migrations

Run once, before real traffic, from your machine (uses `DIRECT_URL`, port 5432):

```bash
pnpm --filter @kloyya/db migrate
```

This includes **0017**, which drops the retired Better Auth tables and moves
identity to Supabase Auth. Destructive and intended (pre-beta, zero users).

## 3. Vercel

1. Push the repo to GitHub → Vercel → **New Project** → import it.
2. **Root Directory = `apps/web`** (Vercel autodetects the pnpm workspace).
3. Set environment variables (Production + Preview) — see the table below.
4. Deploy. The API is just `apps/web/app/api/v1/**`, so it ships with the app.

### Environment variables (Vercel)

| Var | Notes |
|-----|-------|
| `NEXT_PUBLIC_USE_REAL_API` | `true` — without it the site runs on mock data |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — storage + admin ops |
| `DATABASE_URL` | Supabase **pooler** (6543) |
| `DIRECT_URL` | Supabase **direct** (5432) — for migrations |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64url — connector tokens |
| `RESEND_API_KEY`, `EMAIL_FROM` | invitation email |
| `OPENAI_API_KEY` (+ `AI_PROVIDER`) | Ask Kloyya |
| `APP_URL` | your production URL (OAuth redirects, invites) |
| OAuth `*_CLIENT_ID/SECRET/REDIRECT_URI` | per connector you enable |

## 4. OAuth connectors (optional)

For each provider you enable (Google / Microsoft / Notion), set the redirect URI
in **both** the provider console and the matching `*_REDIRECT_URI` env var to:

```
https://<your-app>/api/v1/integrations/oauth/<provider>/callback
```

## 5. Smoke test (on the deployed app)

- `GET /api/v1/health` → `{"status":"ok"}`.
- Sign up → a **6-digit code arrives by email** (Resend) → verify → onboarding →
  dashboard.
- Sign out / sign in; wrong code → clear error.
- Settings shows your real name/role; Ask Kloyya answers (or says "not configured"
  if no `OPENAI_API_KEY`).
- Upload a document → it appears in the list and Ask Kloyya can cite it.
- 31st Ask on the free tier → 429; 6th document → cap error.

## Notes & limits

- **Upload size on Vercel**: Vercel caps request bodies at ~4.5MB. The multipart
  upload path handles files up to that limit today; a direct-to-storage
  **signed-URL flow** (to restore the full 25MB) is the tracked follow-up.
- **Function duration**: `ask`, `documents`, and integration `sync` routes set
  `maxDuration = 60`. A very large first sync may need Vercel Pro (up to 300s).
- **Rollback**: redeploy the previous Vercel build. Migrations are forward-only;
  0017 is destructive, so restore from a Supabase backup if you must revert it.
- **Local real-backend dev**: put the env vars in `apps/web/.env.local` (Next
  reads that, not the repo-root `.env`), then `pnpm --filter @kloyya/web dev`.
