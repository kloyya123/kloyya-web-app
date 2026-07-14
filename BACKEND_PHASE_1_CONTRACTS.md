# Backend Phase 1 — Analysis & Contracts

**Status:** Analysis complete. Blocked on 4 architecture decisions (see §7) before Phase 2 scaffolding.
**Method:** Opus (architecture/contracts), per the agreed workflow. Sonnet implements Phase 2+ against this document.

---

## 0. The central finding

The frontend was built frontend-first behind a strict service-abstraction boundary. That was not just a UI convenience — it means **the backend contract already exists, is fully typed, and has been validated by 516 passing tests.** The backend's job in Phase 1 is not to invent an API; it is to formalize the one the frontend already depends on, and to decide how it is hosted, secured, and populated.

Every claim below is grounded in a file that exists today in `kloyya-web/`, cited inline.

The engineering guarantee we are honoring: *"Only the data layer should change when moving from mock data to production APIs"* (`services/index.ts`). There is exactly one swap point. When the real backend is ready, we write `SupabaseAuthService implements AuthService`, change 13 lines in the registry, and no component, hook, page, or test changes.

---

## 1. Frontend audit — what already defines the contract

### 1.1 The service layer (the API surface)
Thirteen typed service interfaces in `kloyya-web/services/*/types.ts`, each a set of `Promise`-returning methods that either resolve with a domain type or throw a typed `ApiError`. These are the endpoints, already specified:

| Service | Methods (abbreviated) | Becomes REST |
|---|---|---|
| `AuthService` | getSession, signIn, signUp, signOut, requestPasswordReset, verifyEmail, resendVerificationCode, completeOnboarding, updateSettings | `/v1/auth/*` |
| `IntelligenceService` | getDashboard, listRecommendations, recordOutcome, recordFeedback | `/v1/dashboard`, `/v1/recommendations/*` |
| `TaskService` | list (filtered/sorted/paginated), get, create, update, updateStatus, delete | `/v1/tasks/*` |
| `CalendarService` | getSchedule (conflicts + free slots), … | `/v1/calendar/*` |
| `MeetingService` | listMeetings (upcoming/past), getMeeting, getBriefing | `/v1/meetings/*` |
| `InboxService` | listInbox (triaged), getEmail, getInsights | `/v1/inbox/*` |
| `KnowledgeService` | listArticles, getArticle, getGraph | `/v1/knowledge/*` |
| `ProjectService` | listProjects, getProject, getHealth | `/v1/projects/*` |
| `OrganizationService` | getOverview, getMember | `/v1/org/*` |
| `SearchService` | search (cross-entity) | `/v1/search` |
| `NotificationService` | listNotifications, markRead, markAllRead | `/v1/notifications/*` |
| `IntegrationsService` | listConnections, connect, disconnect, pause, resume, reconnect, forceSync, getSummary | `/v1/integrations/*` |
| `SourcesService` | (Trust Center: live source health) | `/v1/sources/*` |

Every method's inputs, outputs, and error codes are already typed. The backend implements these signatures; it does not get to redesign them without a corresponding frontend change.

### 1.2 The transport envelope (`types/api.ts`)
The KAS contract is already modelled and every mock response already conforms to it:
- **Success:** `{ data, metadata?, pagination?, links?, version, timing?, correlationId, warnings? }`
- **Error:** `{ errorCode, httpStatus, message, description, suggestedResolution, correlationId, documentationLink?, timestamp }`
- **Pagination:** cursor-based (`currentCursor`/`nextCursor`/`previousCursor`/`pageSize`/`totalCount?`) — `totalCount` optional by design.
- **Status codes in use:** 400, 401, 403, 404, 409, 422, 429, 500, 503.

The real backend must emit exactly this envelope. The frontend's error-handling (`services/http/errors.ts`, retry logic, the `ErrorState` component) is built against it.

### 1.3 The security posture already encoded in types
- **Tenancy:** every business entity extends `BaseEntity` (`types/domain.ts`) which carries `organizationId`, `workspaceId`, `createdBy`, `updatedBy`, `version`, soft-delete-ready timestamps. Multi-tenancy is baked into the row shape.
- **RBAC:** `ROLES` = owner, administrator, executive, manager, team_lead, employee, contractor, guest, auditor, support, **ai_service, automation_service** (machine principals are first-class).
- **Data classification:** `DATA_CLASSIFICATIONS` = public → internal → confidential → highly_confidential → restricted → regulated. Every `Evidence` row already carries one; it "governs whether the excerpt may be displayed."
- **Secret exclusion by type:** `BaseEntity` comment is explicit — `passwordHash` and server-only columns are *deliberately absent from the client projection*. The backend's DB model is a superset; the API projection strips secrets.
- **Session model:** short-lived `accessToken` + refresh token in an httpOnly cookie the client never reads (`services/auth/types.ts`). Account-enumeration resistance is already a contract requirement (`requestPasswordReset` always resolves).

---

## 2. Data model (derived, not invented)

### 2.1 Core entities (from `types/domain.ts`)
Tenancy & identity: **Organization, Workspace, User, Membership** (role join), **Session**.
Work: **Task, Project, Meeting, MeetingParticipant, EmailThread, KnowledgeArticle**.
Intelligence: **Recommendation, Evidence, ReasoningStep, Conflict, Briefing, Agent, Notification**.
Integrations: **Integration (catalogue), Connection, ConnectedSource, OAuthToken (server-only)**.
Derived/on-demand: **MeetingBriefing, EmailInsights, ProjectHealth** (computed artifacts).

### 2.2 Server-only additions (present in DB, absent from the client projection)
These exist in the database but never appear in a `BaseEntity`-derived API response:
- `User.passwordHash` (or delegated entirely to Supabase Auth — see decision #2)
- `OAuthToken`: `{ connectionId, provider, accessTokenEnc, refreshTokenEnc, scopes[], expiresAt }` — **encrypted at rest**, never returned by any endpoint.
- `AuditLog`: `{ actorId, action, entityType, entityId, orgId, workspaceId, at, ip, correlationId }` — required by KESM Zero-Trust + Phase 8.5.
- `SyncState` per connection: `{ cursor, lastSuccessfulSyncAt, status, failureCount }` — powers incremental sync + the Trust Center.
- `Embedding`: `{ entityType, entityId, vector, model, contentHash, orgId, workspaceId }` — pgvector, permission-scoped.
- `MemoryRecord` (KMSA layers): session / working / long-term / organization / decision / knowledge.

### 2.3 Entity relationships (the graph is real, not decorative)
```
Organization 1─┬─* Workspace 1─┬─* Membership *─1 User
               │               ├─* Task        *─1 User (owner)   ?─1 Project
               │               ├─* Project     *─1 User (owner)
               │               ├─* Meeting     *─* User (participants)   ?─1 Project
               │               ├─* EmailThread
               │               ├─* KnowledgeArticle
               │               └─* Recommendation *─1..* Evidence
               │                                  *─1..* ReasoningStep
               │                                  *─0..* Conflict
               └─* Connection 1─1 OAuthToken
                              1─* ConnectedSource ──▶ (feeds pipeline)
```
Every `Evidence` row points back to a real source record (email/meeting/doc/CRM). The knowledge graph (`KnowledgeService.getGraph`) already asserts, in a test, that *every edge resolves to a node that exists*. The backend must preserve that invariant — no orphaned relationships (this is exactly Phase 8.5's "Relationship Validation").

---

## 3. API surface (the endpoint list)

~40 endpoints across the 13 services, all versioned `/v1/*`, all emitting the KAS envelope. Full enumeration is a mechanical expansion of §1.1 and will live in an OpenAPI 3.1 document generated in Phase 2 (so the contract is machine-checkable against both the frontend types and the backend handlers). Representative shape:

```
POST   /v1/auth/sign-in            → 200 Session | 401 | 429
POST   /v1/auth/sign-up            → 201 Session | 409
GET    /v1/dashboard               → 200 DashboardData
GET    /v1/tasks?cursor&pageSize&sortBy&status&projectId → 200 ApiCollection<Task>
PATCH  /v1/tasks/:id/status        → 200 Task | 404
GET    /v1/meetings/:id/briefing   → 200 MeetingBriefing | 404
POST   /v1/integrations/:id/connect→ 200 Connection | 409   (kicks off OAuth)
GET    /v1/search?q                → 200 SearchResult[]
```

---

## 4. Backend architecture (recommendation)

```
                    ┌─────────────────────────────────────────┐
   Next.js app  ───▶│  /v1 API (route handlers)                │
   (existing)       │  zod-validated → service layer → Prisma  │
                    │  emits KAS envelope, RLS-scoped           │
                    └───────────────┬─────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
   PostgreSQL (Supabase)      Redis (queue+cache)        Object storage
   + pgvector + RLS           BullMQ jobs                (Supabase Storage)
        ▲                           │
        │                           ▼
        │                  ┌──────────────────┐
        └──────────────────│  Worker process  │  ← durable, long-running
   Integration Framework   │  • OAuth sync    │    (NOT serverless)
   (Phase 8) + Pipeline    │  • Phase 9 pipe  │
   (Phase 9)               │  • embeddings    │
                           │  • agents (AI)   │
                           └──────────────────┘
```

**Key structural rule (carried from the frontend):** the API route handlers are thin — validate input (zod), call a service class, serialize the KAS envelope. All logic lives in service classes with **no framework imports**, exactly like `lib/*` on the frontend. This keeps the heavy pipeline extractable to the worker without a rewrite, and keeps everything unit-testable without HTTP.

**Two runtimes, on purpose:**
1. **Request/response** (auth, CRUD, dashboard reads) → Next.js route handlers, can run on Vercel.
2. **Durable work** (OAuth incremental sync, the Phase 9 pipeline, embedding generation, agent runs) → a persistent worker with a queue. Serverless functions time out and are stateless; the pipeline is neither.

---

## 5. Security review (Phase 1 posture)

Grounded in KESM + what the types already require:
1. **Tenant isolation — defense in depth:** Postgres **Row-Level Security** as the hard backstop (a query *cannot* return another org's rows even if app code is buggy) **plus** Prisma-level orgId/workspaceId scoping for ergonomics. This is non-negotiable for enterprise and is Phase 5's core.
2. **Token encryption:** OAuth access/refresh tokens encrypted at rest (envelope encryption, key in a KMS/secret store), never returned by any endpoint. Phase 8.5 will verify revocation immediately halts sync.
3. **Secret exclusion:** the API projection = `BaseEntity` shape; `passwordHash`, `*_enc`, and internal columns physically cannot serialize because the response DTO doesn't include them.
4. **Audit logging:** every mutation and every AI decision writes an `AuditLog` row (actor, action, entity, correlationId). Required for the Trust Center and Phase 8.5.
5. **AI as a principal:** `ai_service` / `automation_service` roles mean agent actions are authorized and audited like any user — an agent cannot read what its invoking user cannot.
6. **Correlation IDs** thread request → service → DB → external API → audit log, already carried in the envelope's `correlationId` and `Timing`.

---

## 6. What Phase 1 does NOT decide (deferred to their phase)
- Exact OpenAPI doc (Phase 2, generated).
- Prisma schema DDL (Phase 3 — but the entity list and relationships above are its spec).
- Connector implementations (Phase 8) and their validation (Phase 8.5).
- The AI pipeline internals (Phases 9, 13–16).

---

## 7. DECISIONS I NEED FROM YOU (these block Phase 2)

Each has my recommendation. You can accept all four and I proceed, or redirect any.

**① Repository topology.** Recommend: backend as **route handlers inside the existing Next.js app** (`app/api/v1/*`) sharing the types package, + a **separate worker process** in the same repo for durable jobs. Rationale: shares the 700+ lines of domain types already written, one deploy for the API, worker extracted cleanly. Alternative: fully separate backend service (more isolation, more boilerplate, type duplication).

**② Data + auth + storage platform.** Recommend: **Supabase** (managed Postgres + pgvector + Auth + Storage + RLS). Rationale: it collapses Phases 3 (DB), 4 (Auth: email verification, password reset, JWT, sessions — all built-in), 10 (Storage), and half of 5 (RLS) into managed infrastructure, and your own doc lists it. Prisma as the ORM on top. Alternative: self-host Postgres in Docker + custom JWT auth (more control, materially more to build and secure).

**③ Multi-tenancy enforcement.** Recommend: **both RLS and app-layer scoping** (defense in depth). If you picked Supabase in ②, RLS is essentially free. Alternative: app-layer only (simpler, weaker guarantee — one buggy query leaks cross-tenant).

**④ AI providers.** Recommend: **Anthropic Claude** (Opus/Sonnet) for the agents/reasoning/briefings, and a dedicated embeddings model (OpenAI `text-embedding-3-large` or Voyage) into **pgvector**. This needs your input because it requires API keys and has cost implications. Alternative: single-provider (e.g., OpenAI for both).

---

## 8. RESOURCES I'll need to start Phase 2 (once ① and ② are settled)
- If Supabase: a Supabase project (URL + `anon` key + `service_role` key), or confirmation to run it locally via `supabase` CLI / Docker first and wire the cloud project later.
- A Google Cloud project with OAuth consent screen + client ID/secret for the first connectors (Calendar, Gmail, Drive) — Phase 8. Not needed until Phase 8, but the sooner the consent screen is in review, the better (Google verification is slow).
- AI provider API key(s) per decision ④ — not needed until Phase 9/14, but good to line up.
- Confirmation of deploy targets: frontend is already on Vercel (from your usage history); where should the **worker + Redis** run? (Railway / Render / Fly / Supabase Edge + queue.)
- Nothing else blocks Phase 2 foundation scaffolding once ①–② are answered.
```
