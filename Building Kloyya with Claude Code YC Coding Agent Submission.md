# How I Built Kloyya's Frontend With an AI Coding Agent Claude Code Using VS Code IDE.

**A technical account for the YC application "coding agent" question**

---

## Summary

Kloyya is an AI Chief of Staff — software that reads across a company's existing tools (email, calendar, documents, CRM) and surfaces evidence-backed recommendations instead of another dashboard to babysit. Over this build I used Claude Code (running Claude Sonnet 5) as the implementation engine for the entire frontend: roughly 21 feature phases, a full design system, and a hardening pass, ending at 516 automated tests across 46 files and a production build that I drove end-to-end on every route before calling anything done.

This document is not a sales pitch for AI tooling. It's an honest account of what the workflow actually looked like, where the agent was reliable, where it wasn't, what I had to catch, and why I think the discipline that emerged — architecture-first, test-driven, verify-in-a-real-browser-not-just-in-theory — is a better predictor of whether I can ship a real product than whether I personally typed every line.

The short version: I set direction and judged output. The agent wrote code, and — critically — the agent also caught its own mistakes when I insisted on verification loops rather than "looks done." Several of the most serious bugs in this codebase were found not by me reading code, but by an automated pass I asked for that neither of us had initially planned to run. That's the part of this story I think matters most for evaluating whether this way of building holds up under real product pressure.

---

## 1. Why I Built This Way

I am not trying to convince anyone that an AI agent is a drop-in senior engineer. It isn't. What it is, in my experience over this build, is a very fast and very literal junior-to-mid engineer with perfect memory of a large codebase, no ego about being told "that's wrong, redo it," and a tendency to declare victory the moment code compiles unless you build a harder definition of "done" into the process itself.

The reason I could move through 21 feature phases of a real product — auth, onboarding, a dashboard, calendar, meetings, an inbox, a knowledge graph, project health scoring, an org directory, a recommendation feed, search, notifications, settings, a tool-connection flow — in one continuous build is not that the agent is magic. It's that I front-loaded architecture decisions once, encoded them as constraints the agent couldn't quietly violate (type system, lint rules, a service-registry boundary), and then spent my own attention on the two things that actually require judgment: deciding what "correct" means for a given feature, and verifying that what got built actually meets that bar in a way that can't be faked by a compiler passing.

I think this is the honest answer to what a coding agent changes for a technical founder: not "you no longer need engineering judgment," but "your engineering judgment gets applied at a much higher leverage point — architecture and verification — instead of being spent typing."

---

## 2. Reading Before Writing

Before any code existed, the project directory held about 30 specification documents: product vision, an AI reasoning architecture (recommendation confidence scoring, evidence requirements, agent taxonomy, memory layering), a design system spec, a security model, and an engineering standards doc. Nothing was scaffolded yet — no `package.json`, no repository.

I had the agent read all 30 documents before writing a line of code, and required it to come back with a concrete list of *conflicts in the specs themselves* rather than silently picking an interpretation. This mattered more than it sounds like it should. The specs disagreed with each other in real ways:

- A "Design Manifesto" document and a "Design System 2.0" document specified different color palettes.
- One spec said the dashboard should show 12 simultaneous widgets; a separate product-principles document said dashboard clutter was explicitly the thing to avoid.
- Three different documents defined three *different* vocabularies for what happens when a user acts on a recommendation (accepted/dismissed/postponed vs. an 8-point quality rating vs. accepted/rejected/ignored/modified).

I resolved each of these explicitly — Design System 2.0 wins because it self-declares as the source of truth; all 12 dashboard widgets get built as components, but a decision-score filter decides what actually renders by default, satisfying both documents; the three feedback vocabularies turned out to be two orthogonal axes (an outcome and a quality rating) that had been conflated, not really in conflict once I looked closely.

I'm including this because it's the first data point on how I actually used the agent: not "generate a product from a prompt," but "extract every conflict a human product owner would eventually have to resolve, and resolve it explicitly before we're both improvising against contradictory requirements six phases later."

---

## 3. The Architecture Decision That Mattered Most

The single decision that shaped everything downstream: every domain-specific behavior lives behind a service interface, and there is exactly one file — `services/index.ts` — where a concrete implementation gets wired to that interface. Every service in the app (`AuthService`, `TaskService`, `MeetingService`, `KnowledgeService`, and so on) is defined as a TypeScript interface plus a `Mock*` class that implements it against realistic in-memory data, with artificial network latency and a configurable failure rate.

The reasoning: I am building this frontend before the backend exists, but I am not building a demo that gets thrown away when the backend is ready. The mock implementations need to disappear cleanly — swapped for real API calls — without touching a single component, page, or test. If a component ever imports mock data directly, or calls a service method that isn't declared on its interface, that guarantee breaks quietly and nobody notices until the day the real backend lands and half the UI needs to be re-plumbed.

So partway through the build, when I found three places where a component had reached past the service layer and imported mock data directly (a demo clock constant, a category-label lookup), I didn't just fix those three call sites. I had the agent add an ESLint rule that makes it a hard build failure for anything outside `services/` or `mock/` to import from `mock/` at all. That's a structural guarantee now, not a code-review habit that erodes over time. This is the pattern I kept returning to: when I catch a violation of an architectural rule, the fix isn't just fixing the instance, it's making the *class* of violation impossible to reintroduce.

The same discipline shows up in how the product's core trust requirement got implemented. Kloyya's whole value proposition rests on never surfacing a recommendation without evidence behind it — "never recommend without evidence, never hide uncertainty, always explain why" is a hard product rule from the spec, not a nice-to-have. Rather than trust that every future engineer (or every future agent session) remembers to check for evidence before rendering a recommendation card, the type itself makes it impossible to construct one without evidence:

```ts
type Recommendation = {
  // ...
  evidence: [Evidence, ...Evidence[]];   // non-empty by construction
  reasoning: ReasoningStep[];
  confidence: number;
  // ...
}
```

A tuple type with a required first element, followed by the rest — TypeScript will not compile a recommendation with zero evidence items. The product's most important rule became something the compiler enforces, not something a linter warns about or a reviewer might miss.

---

## 4. How the Working Relationship Actually Worked

I want to be specific about division of labor, because "I used an AI coding agent" can mean wildly different things depending on how much judgment stayed with the human.

**What I set, every time, before code got written:**

- The product reasoning for the feature — why it exists, what decision it helps someone make faster or with more confidence.
- The architecture — component hierarchy, where state lives (local vs. feature-level vs. global vs. server-cache vs. URL), how the feature's service methods are shaped.
- The verification bar — what "done" means beyond "compiles."

**What the agent did:**

- Wrote the actual implementation: types, mock data, service classes, tests, hooks, components, routes.
- Ran its own gate before reporting anything finished: typecheck, lint, the test suite, and — critically, once I made this non-negotiable — actually driving the running application and hitting real routes with real HTTP requests, not just trusting that green tests meant a working feature.
- When it found problems in its own prior work during a review pass, fixed them and explained why, rather than me having to spot them by reading diffs.

**What I did, continuously, that the agent structurally could not do for itself:**

- Decided when "it passes tests" was not actually sufficient evidence of correctness, and asked for a different kind of check.
- Caught architectural erosion (the mock-import leak above) that no test would ever flag, because tests check behavior, not whether the codebase still matches the shape I decided it should have.
- Made the call, repeatedly, that a feature wasn't done just because a page rendered — for instance, requiring evidence that a filter control's state round-tripped correctly through the URL, not just that clicking it visually changed something.

The clearest illustration of this is what happened when I asked for a real-browser accessibility and responsive-design pass near the end of the build.

---

## 5. The Debugging Story That Best Represents the Whole Project

Going into the hardening phase, the automated test suite was fully green: 500-plus tests, every screen had an `axe-core` accessibility assertion running inside a simulated DOM (`jsdom`), and the production build compiled without errors. By most teams' definition of "tested," this was done.

I didn't think it was done, because `jsdom` is not a browser. It doesn't compute real layout, doesn't apply real CSS cascade edge cases, and axe running against a simulated DOM catches a meaningfully different set of problems than axe running against Chromium actually rendering the page. So I had the agent install Playwright and real `@axe-core/playwright`, and drive every route in an actual headless Chromium instance at four screen widths, in both light and dark themes, plus a scripted keyboard-only tab walk logging whether each focused element had a visible focus indicator.

This single pass found three defects that a fully green, 500-test, axe-clean automated suite had missed completely:

**A global invisible-focus-ring bug.** Every ghost and icon button in the application — the workspace switcher, the notification bell, the theme toggle, every "Later" / "Dismiss" action on a recommendation card — had a keyboard focus ring that was structurally present (correct width, correct color, defined in the design system's CSS) but visually invisible when Tailwind actually compiled it, because a Tailwind utility class in the button component's base styles (`outline-none`) was silently overriding the design system's focus-visible rule at the cascade layer. This is a real accessibility failure — a keyboard-only user has no way to see where focus is — and it is exactly the kind of bug that a simulated DOM cannot detect, because `jsdom` doesn't compute `outline-style` the way a real rendering engine's cascade does.

**Systematic horizontal overflow on mobile.** Five-plus pages scrolled sideways on a 375px-wide viewport. I traced this to one root cause repeated across the codebase: every two- or three-column responsive grid layout was missing an explicit single-column fallback for narrow screens. Without it, a CSS grid column defaults to sizing itself to its widest child's *intrinsic* content width rather than clamping to the available space — so a data table or an SVG diagram inside a grid cell would refuse to shrink and push the entire page wider than the viewport. This wasn't one typo; it was the same missing constraint independently reproduced across eleven different components, because nothing in the type system or the linter was checking for it. I had the agent fix the root cause at all eleven sites, and then, deliberately as a second and separate layer of defense, added a frame-level CSS guard on the main content region so that if the same class of bug is reintroduced in the future by someone who doesn't know this history, it fails safely rather than breaking page-level scroll.

**A contrast failure that only existed at one specific opacity value.** Read notifications were dimmed by lowering the whole card's opacity to visually de-emphasize them. Axe running against real rendering (correctly accounting for compositing against the actual background color in both themes) flagged that this pushed an already-subtle timestamp below the WCAG AA contrast minimum in *both* light and dark mode. The fix — carry "read" state through border weight and an absent badge rather than through opacity — is a two-line change, but it's the kind of failure mode that never shows up unless you check contrast against actual rendered pixels rather than the source color values in isolation.

I'm spending this much space on one debugging pass because I think it's the single best piece of evidence for how I actually evaluate whether this workflow produces something real: not "did the agent write code that compiles," but "when I demanded a harder verification loop than the one that was already passing, did it surface genuine, previously invisible defects — and did we fix the actual root cause rather than the symptom." In all three cases here, the answer was yes, and in all three cases the fix I asked for went one level deeper than the specific bug — the ESLint rule, the eleven-site grid fix plus a defensive backstop, the "never use opacity to carry meaning" pattern applied consistently rather than patched once.

---

## 6. A Real Product Bug, Not Just a Styling Bug

The hardening pass above is about quality-of-implementation bugs. Separately, during the feature-building phase, I found a bug that was a genuine product-correctness failure, not a styling issue — the kind of thing that would have shipped invisibly and quietly broken a core user promise.

Kloyya's onboarding flow asks a new user five questions specifically framed around personalizing the product: team size, what they want out of it, their working style, when they want a morning briefing, how much they want to be interrupted by notifications. The onboarding UI explicitly tells the user *why* each question matters — "Kloyya uses this to decide how proactively to interrupt you," that kind of framing. That framing is a promise: answer this, and the product will behave differently because of your answer.

When I read through the auth service implementation during a later phase, I found that the function completing onboarding took all five answers, used two of them (to set the person's name and job title), and silently discarded the other three. There was nowhere in the session data model to even store them. The onboarding screen was asking a new user five questions and honoring the answer to two of them. The UI's own copy — "this personalizes your experience" — would have been false for the majority of what it asked.

This is exactly the kind of bug that automated tests don't catch by default, because the onboarding flow *worked* — it submitted, it redirected to the dashboard, nothing errored. The only way to catch it was to actually trace, feature by feature, whether every promise the UI copy made to a user was backed by something real happening in the data layer. I added the missing field to the session model, wired the onboarding submission to actually persist all five answers, and then — because a new Settings screen was being built around the same time — made those same five answers editable after the fact, so the product's implicit promise ("tell us once, we'll remember, and you can change your mind") is now actually true end to end.

I flag this one specifically because it's not a bug a linter or a type checker or an accessibility scanner will ever find. It required someone to read what the UI claims to do and check it against what the code actually does, and hold the agent to fixing the underlying gap (add the field to the data model) rather than a surface patch.

---

## 7. Testing Philosophy

Starting from about a third of the way through the build, I required test-driven development for every new piece of logic: the test gets written first, against the interface I want, before the implementation exists. This wasn't a formality — it changed what got built, in a few concrete ways worth naming:

**Pure functions carry policy, not components.** Anywhere the product needed a real business rule — how a project's health score maps to a status label, how a recommendation's decision score determines which delivery channels it's allowed to appear on, how a knowledge-graph node's position gets computed relative to a focus node, how free time gets suggested around calendar conflicts — that rule lives in a small, pure, synchronous function with no framework dependency, tested directly and exhaustively. A component calls the function; it never contains the logic itself. This matters because it means the business rule is provably correct independent of whatever the UI happens to be doing that day, and because it makes the rule a one-file change if the underlying policy is ever revised.

**Mock services simulate failure, not just success.** Every mock service call goes through a shared transport layer with configurable artificial latency and a configurable random failure rate. This exists specifically so that loading states and error states in the actual UI get exercised by real asynchronous timing and real thrown errors during testing, rather than a developer assuming the loading spinner "probably looks fine" because they never saw it render for more than a frame in local development.

**The accessibility bar is a test assertion, not a checklist.** Every screen component has an automated test that renders it and asserts zero accessibility violations, using the same `axe-core` engine that later ran in the real-browser pass. This is enforced the same way a broken feature test would be — a violation fails the build, full stop.

By the end of the build this produced 516 passing tests across 46 test files, covering pure logic, service behavior (including deliberately asserting on 404s, permission errors, and edge cases like an empty result set), and full-screen rendering with accessibility checks.

I want to be honest that the number itself isn't the point — a large test count with weak assertions is worse than no tests, because it creates false confidence. The reason I'm citing it here alongside the specific bugs it did and didn't catch is to be transparent about what automated testing actually bought versus what it didn't: it caught behavioral regressions and logic errors reliably; it did not catch the invisible-focus-ring bug, the mobile-overflow bug, or the contrast-at-a-specific-opacity bug, because those require a real rendering engine. Both types of testing were necessary. Neither was sufficient alone.

---

## 8. Production Hardening

"It builds" and "it works in production" turned out to be different claims, and treating them as the same claim is exactly the kind of shortcut I was watching for.

Near the end of the build I had the agent run an actual production build (not the development server) and then start a real production server process and issue real HTTP requests, with a valid authenticated session cookie, against every one of the app's roughly twenty routes — checking not just that each returned a 200 status, but that the server-rendered HTML actually contained the expected page content, and that requests without a valid session correctly redirected to the login screen rather than leaking a protected page.

The first time I ran this, every single authenticated route returned a server error. The cause turned out to be that a development server and the production server had both been pointed at the same build output directory at different points in the session, and the development server's hot-reload process had partially overwritten the production build's compiled output — a genuinely confusing failure mode that had nothing to do with the application code being wrong. I want to include this because it's an honest example of something going wrong that *wasn't* a code defect — the fix was operational (rebuild cleanly with nothing else writing to the same directory), and distinguishing "the code is broken" from "the way I'm testing the code is broken" was itself a judgment call that mattered.

Once that was resolved, every authenticated route returned 200 with correct content on the actual compiled production artifact, and unauthenticated requests correctly redirected. That's the bar I actually consider "done" for a route: not that it compiled, not that a test suite passed, but that a real server process, serving the real compiled output, answered a real HTTP request correctly.

---

## 9. What This Process Demonstrates

I think the honest claim here is narrower than "AI built my product," and I think the narrower claim is the more credible one for a technical evaluation.

What actually happened: I made every architecture decision, resolved every specification conflict, decided what correctness meant for each feature, and — this is the part I'd push back hardest on anyone dismissing — repeatedly refused to accept "it compiles and the tests are green" as sufficient evidence of quality, which is precisely what surfaced the invisible-focus-ring bug, the mobile-overflow bug, the contrast bug, and the discarded-onboarding-answers bug. None of those were caught because a test failed. They were caught because I kept asking "how do we actually know this is true," found a harder way to check, and held the implementation to that bar.

What the agent did: translated architecture decisions into working code fast enough that 21 feature phases, a design system, and a hardening pass happened in one continuous build rather than a multi-quarter engineering effort, wrote its own tests against the interfaces I specified, and — when I built verification loops hard enough — reliably found and fixed the gaps those loops surfaced, including root-causing systemic issues (the eleven-site grid bug) rather than patching the first instance found.

I think this is a reasonable preview of how I'd actually operate as a technical founder building Kloyya past this point: setting the bar for what correct means, building the verification that proves it, and using whatever tools — including an AI coding agent — get me there fastest without lowering that bar. The product itself is, not coincidentally, making the same bet on a company's behalf: that AI applied with the right verification discipline produces trustworthy output, and applied without it produces something that looks done and isn't.

---

## Appendix: Build Statistics

|                                                                                                    |                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature phases completed                                                                           | 21, plus a dedicated hardening phase and a post-hoc onboarding addition                                                                         |
| Automated tests                                                                                    | 516, across 46 test files                                                                                                                       |
| Test types                                                                                         | Pure-function unit tests, mock-service behavior tests (including error paths), full-screen render tests with automated accessibility assertions |
| Routes verified end-to-end on a real production build                                              | 21, all returning correct authenticated content; unauthenticated requests correctly redirected                                                  |
| Real-browser accessibility passes                                                                  | Full route set, 4 viewport widths, both color themes, scripted keyboard-only navigation                                                         |
| Structural bugs found only by real-browser testing (not caught by the full automated suite)        | 3 (invisible focus rings, mobile horizontal overflow at 11 sites from one root cause, opacity-driven contrast failure)                          |
| Product-correctness bug found by manual promise-tracing                                            | 1 (onboarding preference answers collected but not persisted or usable)                                                                         |
| Architectural boundary violations found and converted into structural (linter-enforced) guarantees | 1 (UI-layer imports of mock data, closed via an ESLint rule rather than a one-off fix)                                                          |
