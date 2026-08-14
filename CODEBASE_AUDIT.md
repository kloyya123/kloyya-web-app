# Kloyya — Codebase Audit

**Date:** 2026-08-14
**Scope:** `apps/web` (Next.js 15 App Router monolith), `packages/db` (Drizzle/Postgres), `packages/core` (shared domain types/permissions).
**Method:** Direct code reading plus four parallel research passes (auth/authorization, database/RLS, integrations/OAuth, frontend/storage). Every claim below is sourced to a file; nothing here is inferred from the product pitch or README.

This document is Part 1 of the cleanup pass described in the CTO handoff brief — written *before* any further changes, per that brief's own instruction. It describes what exists today, not what should exist.

---

## 1. Architecture, in one paragraph

One Next.js 15 app (`apps/web`) serves the marketing site, the authenticated product, and the API — there is no separate backend. Route Handlers under `app/api/v1/**` are the API; `server/**` holds all business logic, organized by domain (`ask`, `documents`, `knowledge`, `integrations`, `tasks`, `projects`, `drafts`, `dashboard`, `briefing`, `meetings`, `notifications`, `search`, `sources`, `ai`, `auth`, `http`, `tenant`, `plan`, `crypto`, `storage`). `packages/db` owns the Drizzle schema and a tenant-scoping helper; `packages/core` holds shared types, permissions, and entitlements consumed by both server and client. The frontend under `app/` is thin route wrappers around `features/**`, each feature owning its own `components/` and `hooks/`. Auth is Supabase Auth (`@supabase/ssr`), not the "Better Auth" some comments still reference (see §3). Deployment is Vercel; the database is Supabase Postgres with RLS as a hard tenant boundary, not just an app-level convention.

## 2. Main directories

```
apps/web/
  app/                    route handlers (api/v1/**) + page routes (thin)
  features/               19 feature modules — components + hooks, one per product area
  components/ui/          shared design-system primitives (curated public surface)
  server/                 all business logic, by domain (see below)
  services/                client-side API/service layer (real + mock, swappable)
  lib/                    cross-cutting client utilities (analytics, format, speech, etc.)
  styles/tokens.css        semantic design tokens ("Kloyya Design System 2.0")
  middleware.ts            route gating (not an authorization boundary — see §3)
packages/db/
  src/schema.ts            947 lines, 20 tables, all RLS-enabled
  src/scope.ts             withTenantScope — sets the Postgres session that RLS reads
  drizzle/                 31 migrations, 0000–0030
packages/core/
  domain.ts, permissions.ts, entitlements.ts, integration-catalogue.ts
```

Scale: 78 non-test server files / 29 server test files; 58 API route files; 19 feature modules; 31 migrations.

## 3. Authentication flow

**Supabase Auth**, via `@supabase/ssr`, cookie-based. `apps/web/services/auth/supabase-auth-service.ts` is the real implementation; a parallel mock (`mock-auth-service.ts`, unsigned demo cookie) exists for local/demo use, switched by `NEXT_PUBLIC_USE_REAL_API`.

- **Signup** → `supabase.auth.signUp()`, email confirmation required, no session until verified. Already-registered emails are detected via `identities.length === 0` rather than a raw error (avoids enumeration).
- **Verify** → `supabase.auth.verifyOtp({ type: 'email' })`, a 6-digit code.
- **Login** → `signInWithPassword()`, then the app's own `/v1/session` composes profile/org/workspace on top of the Supabase identity.
- **Logout** → `signOut()`. **Password reset** → `resetPasswordForEmail()`, landing on `/reset-password`, which is explicitly exempt from every middleware gate because the recovery link itself establishes a real session.
- **Sessions**: `middleware.ts` calls `supabase.auth.getUser()` (not `getSession()`) on *every* request — this revalidates the JWT server-side and refreshes it, carrying rotated cookies onto the response. A failed Supabase call degrades to "unauthenticated" rather than 500ing the whole site. Cookie flags (HttpOnly/Secure/SameSite) are set by `@supabase/ssr` itself, not this codebase.
- **Route gating** (`middleware.ts`, `decide()`): a documented state machine over `{authed, verified, onboarded, allowed}`. It explicitly self-documents as **"a routing convenience, not an authorization control"** — every API route re-authorizes independently. This is the correct model and is stated as a design invariant, not assumed.

**Known doc debt, not a behavior bug**: several comments (`packages/db/src/scope.ts`, `server/users/ensure.ts`, `onboarding.ts`) still say "Better Auth." The actual, only auth system is Supabase Auth — `server/config.ts` even documents that Better Auth env vars were dropped. These comments should be corrected; nothing functional depends on them.

## 4. Authorization & tenant isolation

Defense in depth, verified at multiple layers:

1. `resolveStartContext` derives `{userId, workspaceId, organizationId}` server-side from the authenticated user's own profile row — never from client-supplied IDs.
2. `withTenantScope` (`packages/db/src/scope.ts`) runs every scoped query inside a transaction that does `SET LOCAL ROLE app_tenant` + `set_config('app.current_org_id', …)`. This drops the table-owner role (which would otherwise bypass RLS) and sets the session variable RLS policies actually check. **This means a forgotten `WHERE workspaceId = …` still cannot return another tenant's rows** — enforcement is at the database, not just in application code.
3. All 20 tables in `packages/db/src/schema.ts` call `.enableRLS()`. Migration `0023_security_hardening.sql` additionally revoked default PostgREST grants from `anon`/`authenticated`, and its own commentary claims RLS is enabled and forced everywhere — this was not independently re-verified against a live database connection in this pass.
4. `assertPermission()` (`server/auth/permission.ts`) resolves the caller's role from their active workspace membership against a capability matrix in `@kloyya/core/permissions`, called explicitly inside handlers where authorization depends on request content, not just route shape.
5. `kasRoute()` (`server/http/handler.ts`) wraps every route with session/verification guards and per-user rate limiting before the handler runs at all.

No `/admin` routes or admin UI exist in the codebase today — there is nothing to separately secure yet, but also nothing to point to as "the admin auth model" when one is built.

## 5. Database

20 tables, all workspace/organization-scoped except `waitlist` (keyed by email, outside the tenant model by design) and `rateLimits` (non-tenant abuse guard). Notable design choices:

- `syncRecords` stores raw, verbatim provider payloads (append-mostly, tombstoned rather than deleted) — the system of record for everything Ask Kloyya and Knowledge read.
- `askUsage`, `briefings`, `meetingBriefings` are all cache tables keyed to a day or a resource, not recomputed on every read.
- 12 RBAC roles in `membershipRole`, including machine principals (`ai_service`, `automation_service`) — the permission model already anticipates non-human actors, not just users.

**Migrations**: 31 files, sequential, `meta/_journal.json` consistent with all of them. 9 hand-authored security/RLS migrations (0010, 0012, 0014, 0016, 0020, 0023, 0024, 0027, 0029) have no matching `meta/*_snapshot.json` — they were written by hand rather than `drizzle-kit generate`. This is not a live bug, but it means drizzle-kit's own diffing could misbehave on the next `generate` if it's not aware these gaps exist; worth a deliberate check before the next schema change rather than an assumption that `generate` will produce a clean diff.

**Indexes**: tenant-scoping columns are consistently indexed. `0023_security_hardening.sql` itself documents backfilling 12 previously-missing FK indexes found live in production — meaning indexing wasn't complete on the first migration pass, but was caught and fixed rather than left.

**Dead schema**: `organizations.plan` is explicitly commented as pre-beta and superseded by `subscriptionTier`, but is still read in three places (`server/organization/service.ts`, `server/users/service.ts`) — deprecated, not dead. No other orphaned tables/columns found.

**N+1 pattern**: `knowledge/service.ts`'s `ensureSummaries` loops over document rows, issuing one AI call *and* one `UPDATE` per row inside the loop. As of this session it is capped (`MAX_SUMMARIES_PER_LIST_CALL = 1` on the list endpoint) specifically because each iteration is a real, slow model call that risks the route's function timeout — see §7. The single-document detail endpoint still runs uncapped, which is fine at N=1.

## 6. Integrations

Five integrations are real and fully wired, end to end: **Gmail, Google Calendar, Google Drive, Notion, Slack**. No mocks in the sync path. The UI's integration catalogue (`packages/core/src/integration-catalogue.ts`) deliberately excludes everything else (Teams, Jira, Salesforce, GitHub, WhatsApp) with an explicit comment that a card which does nothing costs user trust — **the product does not claim integrations it hasn't built**. The one inconsistency: a couple of comments/docstrings mention "Microsoft" OAuth, but no Microsoft/Outlook connector file exists anywhere — aspirational documentation, not code, and not user-facing.

- **OAuth**: connect → provider redirect → callback → encrypted token storage (AES-256-GCM, `server/crypto/tokens.ts`). Refresh handles expiry with a 60s skew; a permanently revoked token is nulled out rather than retried forever.
- **Scopes**: Calendar/Gmail/Drive are all read-only (`calendar.readonly`, `gmail.readonly`, `drive.metadata.readonly` — not Drive *content*). This is stated as deliberate, matching the product's "never edit without being asked" promise.
- **Sync**: cron-polling (Vercel Cron, `CRON_SECRET`-gated), not webhooks. Provider-native incremental cursors persisted per connection; a truncated run does not advance the cursor, so a retry resumes rather than restarts. Failures are classified transient-vs-permanent, with exact user-facing copy per integration.
- **Idempotency**: `INSERT ... ON CONFLICT DO UPDATE` keyed on `(connectionId, resourceType, externalId)`, deduped in-memory first, and the update only fires when content actually changed. A duplicate sync run or overlapping page is a no-op write, not a duplicate row.
- **Known gap, already documented in code**: vision/OCR for uploaded images only supports OpenAI/Perplexity's vision API shape. An Anthropic-only deployment silently falls back to filename-only extraction — no OCR happens, and nothing currently surfaces that degradation to the user.

## 7. AI system

Five providers behind one interface (`server/ai/provider.ts`): OpenAI, Anthropic, Perplexity, NVIDIA, Hugging Face. `AI_PROVIDER` names the preferred one; `resolveAiProvider()` falls through the rest automatically if the preferred one has no key or fails. Every provider call now (as of this session) has its own 45-second deadline via `AbortSignal`, independent of any route's own function-duration budget — added specifically because a hung model call was blowing past Vercel's platform timeout and returning a non-JSON response the client couldn't parse.

Flow, per the brief's own framing:

```
Input (question/document) → retrieveContext (full-text search over syncRecords + documents,
  tenant-scoped) → optional web search (Perplexity Sonar, only when the workspace looks thin
  or the question explicitly asks to look outside) → model call, told to answer ONLY from the
  retrieved context → citation list built from the actual retrieved records (never invented
  by the model) → response
```

**Currently running in production**: `AI_PROVIDER=nvidia`, model `openai/gpt-oss-120b` — a reasoning model that spends tokens on an internal chain-of-thought before writing its answer, and is materially slower (10–40+ seconds per call) than the other four providers. This was the root cause of two live incidents fixed this session:

1. Every caller requested far too few tokens for this model's reasoning overhead, so `content` came back `null` and every real Ask/summary/briefing call silently failed. Fixed with a fixed token-headroom allowance and a fallback to the reasoning trace itself.
2. Several AI-calling routes (`dashboard`, `knowledge/articles`, `meetings/[id]/briefing`) had no `maxDuration` set at all, defaulting to the platform's short default — meaning any real (slow) model call would be killed mid-flight by Vercel itself, producing an unparseable response. Fixed by adding `maxDuration = 60` to each, adding `reasoning_effort: 'low'` to cut actual generation time, and capping the Knowledge list endpoint to one on-the-fly summary generation per request.

`AI_PROVIDER`'s schema default in `server/config.ts` is still `'openai'` — harmless since the real env var overrides it, but worth updating so the default reflects operational reality rather than a discontinued plan (OpenAI is currently unfunded and fully removed from the fallback chain by leaving its key blank).

**Never fabricates sources**: citations are built from records the retrieval step actually returned, not free text the model wrote — verified in `server/ask/service.ts`'s `toCitation`/`toWebCitation`.

## 8. Ask Kloyya

`server/ask/service.ts`. A command ("create a task…") is handled directly, no model call. A question retrieves workspace context, optionally searches the web, and answers strictly from what was retrieved — the system prompt requires the model to say plainly when the context doesn't cover the question rather than guess. Web search triggers on a thin-workspace heuristic or an explicit signal ("google this," "look this up," etc. — broadened this session). Citations distinguish workspace data (authoritative) from web results (not authoritative, must be labeled in the answer itself). Untrusted content (anything from a connected tool, since it was written by someone other than the user) is fenced per `server/ask/untrusted.ts` so it cannot be read as an instruction.

## 9. Morning briefing / meeting briefing

Both cached per-day or per-meeting (`briefings`, `meetingBriefings` tables) — a briefing that reworded itself on every dashboard refresh would be harder to trust than a stable one, and each is a real, costed model call. `generateBriefing` never throws on an AI failure (`AiError` → `null`, dashboard renders the empty state); this session added `maxDuration` where it was missing so the *first* read of the day, which pays the real model-call cost, doesn't get killed by the platform before it finishes.

## 10. Storage & file uploads

`server/documents/upload.ts` + `mime.ts`. Filenames are sanitized to `[\w.-]`, truncated to 120 chars, and prefixed with a random UUID before being used as a storage path — no path traversal is possible. `assertOwnedPath` rejects any finalize request whose path isn't under the caller's own workspace prefix, closing a cross-tenant confusion attack on the signed-URL flow. The MIME allowlist explicitly documents *why* (stored-XSS risk via `image/svg+xml` served back through a signed URL) and has a belt-and-braces denylist as backup. Uploads go straight from the browser to Supabase Storage via a signed URL — the server never proxies raw file bytes past its own 25MB cap. Document count is capped per plan, server-side, with an explicit comment that a client-side cap alone is "a suggestion."

**Not verifiable from this repo**: the actual bucket ACL (public vs. private) is presumably set in the Supabase dashboard, not in migrations or code found here — this should be independently confirmed rather than assumed.

## 11. Environment & configuration

`server/config.ts` is a single Zod schema every server env var passes through — the process refuses to boot on a missing/malformed required value rather than failing at the first request that needs it. Every optional integration (email, AI, push, OAuth pairs) degrades honestly when unset: the feature just doesn't activate, nothing crashes. `TOKEN_ENCRYPTION_KEY` is validated to be exactly 32 bytes at boot. `CRON_SECRET`-gated cron endpoint refuses to run rather than defaulting open when the secret is unset.

`middleware.ts` reads `MAINTENANCE_MODE` directly from `process.env` (not through the validated config, since middleware runs on the Edge runtime) as a same-request kill switch — flip one Vercel env var, no redeploy, and the whole site serves a 503 instead of an outage.

One temporary debug artifact: `x-kloyya-gate` response header (`middleware.ts`), added to debug the beta allowlist, explicitly marked in its own comment for removal once that configuration is confirmed stable. It leaks only counts/lengths, never an email, but it should be tracked and removed rather than left indefinitely.

## 12. Frontend / design system

`components/ui/` is a genuine curated primitive library (Button, Card, Dialog, EmptyState, ErrorState, Skeleton, Table, Toaster, etc.) with a documented rule that features import only from the barrel, never from a file inside it. `styles/tokens.css` defines a real semantic token system ("Kloyya Design System 2.0") including explicit WCAG-AA-reconciled "on-color" foreground pairs. Spot-checked feature views (`tasks`, `documents`) correctly handle loading/error/empty states with retry affordances — no crash-while-loading pattern found in the sample checked. No `.old.`/`.deprecated.`/`.backup.` files exist anywhere in the tree; nothing suggests abandoned experiments sitting unused in the repo.

Two client components are large enough to be worth splitting eventually: `features/landing/components/landing-page.tsx` (683 lines) and `features/onboarding/components/onboarding-wizard.tsx` (553 lines). Neither is pathological for a single-page marketing/wizard flow, but both are the natural first candidates if this becomes a maintenance problem.

## 13. Testing & CI

78 non-test server files against 29 server test files — a real, not token, test suite (743 tests passing across the whole app as of this session, server layer running against a real in-memory Postgres via PGLite with actual migrations, not a mocked DB). **No CI pipeline exists** — no `.github/workflows`, no automated test/lint/typecheck gate on push or PR. Verification currently happens by a human running `pnpm typecheck && pnpm lint && pnpm test && pnpm build` locally (or Vercel's own build step, which runs `next build` including typecheck, but not lint or tests) before pushing. This is the single largest process gap relative to the "production-ready for a team" bar: nothing currently stops a broken PR from merging on green vibes alone.

## 14. Observability

No dedicated error-tracking/alerting service (no Sentry or equivalent) — errors surface only via `console.error`/`console.warn` into Vercel's function logs. `errorResponse()` (`server/http/handler.ts`) does log every 5xx with its correlation ID, so a specific failure is traceable *if someone is looking at the logs*, but nothing pages anyone or aggregates failure rates. This is a real gap for a product that already depends on several external APIs (five AI providers, five integrations) that will each have bad days.

## 15. Known technical debt (concrete, sourced — not speculative)

| Item | File(s) | Severity | Note |
|---|---|---|---|
| Stale "Better Auth" comments | `packages/db/src/scope.ts`, `server/users/ensure.ts`, `onboarding.ts` | Cosmetic | No behavior impact; misleads a new reader |
| `x-kloyya-gate` temporary debug header | `apps/web/middleware.ts` | Low | Self-documented for removal once allowlist is confirmed stable |
| `AI_PROVIDER` default still `'openai'` | `apps/web/server/config.ts` | Low | Real env var overrides it; default is stale documentation |
| 9 migrations missing drizzle snapshot files | `packages/db/drizzle/meta/` | Medium | Hand-authored security SQL; verify before next `drizzle-kit generate` |
| Anthropic has no vision/OCR path | `server/documents/extract.ts` | Medium | Silent degradation to filename-only extraction, not surfaced to the user |
| `organizations.plan` deprecated but still read | `server/organization/service.ts`, `server/users/service.ts` | Low | Superseded by `subscriptionTier`; not yet removed |
| No CI pipeline | (repo-wide) | **High** | Nothing blocks a broken PR from merging |
| No error-tracking/alerting service | (repo-wide) | **High** | Failures are only visible if someone greps logs |
| NVIDIA model is materially slow (10–40s/call) | `server/ai/provider.ts` | Medium | Functionally fixed against timeouts this session; still a real UX cost vs. the other four providers |
| Bucket ACL not verifiable from repo | Supabase dashboard (external) | Needs verification | Confirm private-by-default directly in Supabase, not assumed from code |

## 16. What is genuinely strong here

Worth stating plainly, since an audit that only lists problems misrepresents the codebase: tenant isolation is enforced at the database layer, not just in application code (§4) — this is the single most important security property for a multi-tenant SaaS and it is done correctly. OAuth token encryption, signed-state CSRF protection, and file-upload path/MIME safety are all deliberate and documented, not accidental. Sync idempotency is correct under duplicate delivery and partial failure. The integration catalogue does not overclaim what the product can do. Test coverage on the server layer runs against a real database, not mocks. Zero TODO/FIXME markers exist in server or app code — this is an actively maintained codebase, not one accumulating debt silently.

## 17. Recommended cleanup order

1. **CI pipeline** (§13) — highest leverage, lowest risk, unblocks everything else being trusted going forward.
2. **Error tracking/alerting** (§14) — currently the only way to know something's broken in production is a user reporting it, which is exactly how the two AI-timeout incidents fixed this session were discovered.
3. Verify the 9 unsnapshotted migrations don't produce a bad diff before the next schema change (§5).
4. Confirm Supabase Storage bucket ACL directly (§10) — five-minute check, closes an "assumed, not verified" gap.
5. Cosmetic/low-severity items in §15 (comments, stale default, debug header) — cheap, no rush, batch them into one pass.
6. Decide whether Anthropic vision support is worth building or whether the silent-degradation should at least become a visible one (§6).

This ordering optimizes for "what would most reduce the chance of the next incident looking like today's," not for effort.
