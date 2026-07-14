# Kloyya — Build Log

A structured record of the Kloyya frontend build, reconstructed from the working session. This is not a verbatim chat transcript (the raw conversation spans many phases and would be thousands of lines of low-value scrollback) — it's the durable record: what was built, in what order, the architecture decisions made along the way, the bugs found and fixed, and what's still pending.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Radix UI (hand-built primitives) · Zustand · TanStack Query · React Hook Form + Zod · Vitest + React Testing Library + jest-axe
**Location:** `kloyya-web/`
**Status as of this log:** Phases 0–21 complete, hardened, browser-verified. Connect-tools onboarding step shipped. Voice Intelligence spec received, not yet started.

---

## 0. Foundation

Reviewed all 30 source specification documents (product vision, AI architecture — KARE/KAOP/KAIA/KDSE/DCTF/KESM/KMSA/KOMGA — design system, security model, engineering standards) before writing any code. Resolved the conflicts the specs left open:

| Conflict | Resolution |
|---|---|
| Design System 2.0 vs. Design Manifesto palette | KDS 2.0 wins — self-declared source of truth, only complete token set |
| App location | `kloyya-web/` subfolder |
| `/` behavior | Redirects to `/login` or `/dashboard` depending on session |
| Testing | Vitest + RTL + jest-axe from Phase 1 onward |
| Dashboard density (12 widgets vs. "don't clutter") | All 12 built; Decision Score filters what actually surfaces |
| Confidence bands, decision-score bands | Isolated in single derived-value files (`lib/decision-score.ts`, `lib/confidence.ts`) so a spec correction is a one-file change |

Scaffolded Next.js 15 + React 19 + TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Tailwind v4 CSS-first tokens, KFA folder structure (`app/ components/ features/ hooks/ lib/ mock/ providers/ services/ styles/ types/`), ESLint flat config with **KFA layering enforced as lint rules**, not convention:

- `components/`, `hooks/`, `lib/`, `utils/` may never import `@/features/*`
- `components/` may never import `@/services/*` (UI never calls services directly)
- **Nothing outside `services/` and `mock/` may import `@/mock/*`** (added during hardening — see §22)

`services/index.ts` is the single backend swap point: every service is an interface + a `Mock*` implementation; the registry is the only file a real backend integration touches.

---

## 1–13. Design System → Calendar

Built in order, each phase gated on typecheck + lint + tests + a Principal-Engineer review pass before the next started:

1. **Design System** — KDS 2.0 tokens as CSS variables, dark default / light toggle, full type scale, 4px spacing, 5-level elevation, motion durations honoring `prefers-reduced-motion`. Primitives: Button, Card, Input suite, Table, Dialog, Drawer, Badge, Avatar, Toast, Skeleton, KPI Card, Empty State, Command Palette — each with variants/sizes/states/a11y/tests.
2. **Domain types + mock service layer** — the full domain model (`types/domain.ts`), one coherent fictional organization (**Northwind Robotics**) in `mock/organization.ts` where every recommendation's evidence points at a real record elsewhere in the same file.
3. **AI component library** (`components/ai/`) — the eight primitives KFA/KDS both name: `ExecutiveBrief`, `RecommendationCard`, `ConfidenceBadge`, `ReasoningPanel`, `EvidenceViewer`, `SourceReferences`, `AgentStatus`, `FeedbackPanel`. The DCTF Golden Rules ("never recommend without evidence") made **structural**: `NonEmpty<Evidence>` is a type that makes an evidence-free `Recommendation` a compile error, not a code-review comment.
4. **Application shell** — sidebar, topbar, workspace switcher, ⌘K trigger, notification bell, theme toggle, mobile nav.
5. **Authentication** — Login, Sign Up, Forgot Password, Verify Email. Mock auth service with rate limiting, account-enumeration resistance, open-redirect guard on `?next=`.
6. **Onboarding** — multi-step wizard (name, role, company, team size, goals, work style, briefing time, notification level), each step explaining *why* it personalizes Kloyya.
7. **Workspace Initialization** — staged progress screen replacing a splash screen; every stage names what's actually happening ("Building your Knowledge Graph"), never a bare spinner.
8. **Executive Dashboard** — Morning Brief, Priorities, Recommendations, Calendar, Inbox Summary, Meeting Prep, Knowledge Updates, Org Overview, Project Health, Risk Alerts, Quick Actions, Decision Insights — ranked by Decision Score so low-priority widgets collapse.
9. **Review gate.**
10. **Tasks** — full table, sortable, filterable, ranked by AI priority score.
11. **Sources / integrations catalog groundwork.**
12. **Connections** ("Select Your Tools") — full integration catalog (50+ tools across 14 categories), `ConnectionManager`, `IntegrationCard`, `ConnectDialog` with a staged permission-review + mock OAuth + sync-progress flow. This built the components that the Phase-22.5 connect-tools onboarding step later reused wholesale.
13. **Calendar** — week view, conflict detection, free-slot / focus-time suggestion (`lib/calendar-math.ts`, pure + TDD).

---

## 14–21. Feature Phases (TDD from here on)

The user asked for **TDD from Phase 11 onward**. Every phase below follows the same shape: pure logic module (tests first) → mock service (tests) → hooks → components → route → nav → review pass.

### 14 — Meetings
`MeetingBriefing` type (pre-meeting: headline, objective, talking points, risks, confidence, evidence). `MockMeetingService` splits upcoming/past against a **narrative clock** (`MOCK_NOW`, pinned to 2026-07-10), not `Date.now()` — real time passing must never age a scripted "upcoming" meeting into the past. Calendar event blocks with a `meetingId` became links into meeting detail.

### 15 — Inbox
Priority triage: `lib/inbox-priority.ts` splits **Needs attention** vs **Everything else** (High-band importance *or* awaiting reply), pure and tested. Each item states *why* it ranks there. Per-email `EmailInsights` (suggested replies, extracted tasks, detected meeting) — absent is valid, same as a routine meeting with no briefing.

### 16 — Knowledge
Articles + a **knowledge graph**. The graph layout (`lib/graph-layout.ts`) is a deterministic radial BFS from a focus node — not a physics simulation, which would be non-deterministic and untestable. The SVG is `aria-hidden`; a **connections panel** is the accessible equivalent, reaching every node via real links. Graph nodes point at real records — a service test asserts every edge resolves to a node that actually exists.

### 17 — Projects
Health-ranked board (worst health first — `lib/project-health.ts`). Per-project `ProjectHealth` analysis: a headline plus positive/negative drivers, so a health score is always a *reasoned* number, never just a color.

### 18 — Organization
Directory ordered by seniority (`lib/org-roles.ts` — `ROLES` is already most-senior-first, so rank is an index). Member profiles resolve owned projects + assigned tasks. Closed the graph's person/org nodes, which had been dead ends since Phase 16.

### 19 — Recommendations
The feed — the product's spine on its own surface. `lib/recommendation-feed.ts` splits **Needs a decision** vs **Already decided**, ranked by decision score. Proved the feed is genuinely wider than the dashboard (a Medium-priority item the dashboard's channel filter excludes) with a service test.

### 20 — Search
Cross-entity search over one coherent index built from the same mocks every other screen reads (`lib/search.ts` — pure ranking: title-prefix > subtitle > substring > keyword, AND-matched terms). Command palette (⌘K) upgraded from nav-only to real entity search + "See all results." Query lives in `?q=` — the canonical URL-state feature.

### 21 — Notifications & Settings
**Notifications:** found and fixed a real bug — the bell read from the dashboard payload while a dedicated page needed its own mark-read, so the two would have silently disagreed. Unified on one shared mutable store both read from.
**Settings:** found and fixed a bigger bug — onboarding *collected* team size, goals, work style, briefing time, and notification level, then **`completeOnboarding` silently discarded all but two of them**. `Session` had nowhere to put them. Added `preferences` to `Session`, `updateSettings` to `AuthService`, and a full settings form — so the answers onboarding asks for are now actually kept and editable.

---

## 22. Hardening

The production build had **never been driven** — only compiled. Driving every route surfaced that the dev server and `next start` were both writing to the same `.next`, clobbering each other (a process mistake, not a code bug). Clean rebuild → **all 21 routes 200** on the real production artifact.

**jest-axe on every screen** (the plan mandated this; the 8 features built in Phases 14–21 had zero component tests). Added them, and axe caught two real `heading-order` (WCAG 2.4.6) violations from `CardTitle`'s default `<h3>` sitting directly under a page `<h1>` — fixed across 7 files.

**Backend-swap boundary was quietly broken.** Three UI files imported `@/mock` directly (`MOCK_NOW`, `CATEGORY_LABELS`) — meaning `mock/` could not actually be deleted the day a backend lands, despite that being the explicit promise of the service-registry architecture. Fixed with a clock seam (`lib/clock.ts` — mock registry installs the narrative clock; a real backend just never calls `setClock`, and wall time takes over) and moved the labels to feature-local meta. **Then encoded the rule in ESLint** so it cannot regress silently again.

**URL-state debt closed** — Knowledge (view + category), Recommendations (priority), Notifications (unread) now live in `?query=` via a shared `useUrlState` hook, matching Search and Tasks.

### 22.5 — Real Browser Pass

No browser tooling was available in-environment; installed Playwright + `@axe-core/playwright` directly rather than relying on jsdom's approximation. This caught three defects **invisible to the entire jsdom + jest-axe suite**:

1. **Every ghost/icon button had an invisible focus ring** (WCAG 2.4.7). `Button` carried `outline-none`; Tailwind's utility layer beat the `:focus-visible` base-layer rule, so the ring kept its width/color but lost its style. The line was also redundant — `:focus:not(:focus-visible)` already suppressed mouse rings globally.
2. **Five+ pages scrolled sideways on mobile** (WCAG 1.4.10) — one systemic cause: CSS grid children default to `min-width: auto`, so a column holding wide content (calendar grid, graph SVG, a card) refused to shrink and pushed the whole page out. Root-caused further to **every grid in the codebase missing an explicit base `grid-cols-1`** (11 sites) — without it, mobile falls back to an implicit `auto` column with no clamp. Fixed at the source (grid columns), then added an `overflow-x-clip` **frame guard** on the shell's `<main>` as a backstop against the next one, not a replacement for the real fix.
3. **Notification read-state contrast failure** — `opacity-70` on read cards multiplied down an already-subtle timestamp below AA in both themes. Read state is now carried by border/weight/badge, never by opacity.
4. Also found and removed a `sticky` table header that had never actually worked (its own `overflow-x-auto` wrapper was its scroll container, not the page).

Re-verified: **0 axe violations across all 20 routes, both themes; 0 pages overflow at 375/768/1280; every focus stop has a visible ring.**

---

## 22.7 — Pre-Connect Tools Onboarding Step

**Requirement:** insert a tool-connection step between onboarding and workspace creation — `Signup → Connect Tools → Create Workspace → Dashboard` — so the workspace initializes with real context from day one.

Built as an *integration*, not a rebuild — Phase 12's `IntegrationCard`, `ConnectDialog` (full OAuth-shaped permission review + staged sync), and `IntegrationsService` were reused wholesale.

- `OnboardingConnectStep` — 11 curated tools across 4 groups (Communication / Productivity / Development / Business), not the full 50+ catalog (a new user facing the whole catalog clicks Skip). Live "N tools connected" status. **Create My Workspace** and **Skip and continue** (which disappears once something is connected — skipping stops meaning anything once you have context).
- New route `/onboarding/connect-tools`; wizard's final submit now routes here instead of straight to workspace-init; middleware given the same "reachable after onboarding, before dashboard" exception `/workspace-init` already had.
- **Settings** gained a read-only "Connected tools" card (count + Manage link) — read-only deliberately, so connection state has exactly one editor (the Connection Manager).
- Verified: routing matrix driven for all three auth states (unauthenticated / mid-onboarding / just-provisioned) × 5 routes; SSR content confirmed; real-browser axe 0 violations; production build compiles the new route.

---

## Verification discipline used throughout

Every phase, before being called done:
1. `pnpm typecheck` — zero errors
2. `pnpm lint` — clean (including the KFA layering rules)
3. `pnpm test` (Vitest) — unit + service tests, jest-axe on every screen
4. `pnpm build` — production build, actually driven end-to-end at 200 on every authenticated route (not just "compiles")
5. Real Playwright + axe pass at 375/768/1280/1920, both themes, keyboard-only tab walk
6. A Principal-Engineer review pass looking specifically for duplicated logic to extract, not just correctness

**Test count at last full run:** 516 tests across 46 files, all passing.

---

## Pending

- **Voice Intelligence** (spec received, not started): "Hey Kloyya" wake phrase, natural-language task/reminder/scheduling delegation, background inbox monitoring with voice alerts, a Voice Orb UI (idle/listening/thinking/executing/done states), and a modular pipeline (speech recognition → intent → context engine → memory → reasoning → tool execution → voice response) built with the execution layer swappable, same spirit as the services registry. Scoped as V1: voice conversation + commands + Gmail/Calendar integration + task creation + summaries only — background monitoring and multi-step autonomous workflows are explicitly V2/V3.
- Full keyboard-only + screen-reader walkthrough beyond the automated axe pass.
- Bundle-size analysis on the heavier routes (`/onboarding`, auth screens).
