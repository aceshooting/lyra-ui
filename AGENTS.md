# AGENTS.md — contributor guide for AI coding agents working ON this repo

> **Scope note:** this file is for agents (Claude Code, Codex, etc.) modifying lyra-ui's own
> source. It is NOT the consumer-facing API reference for apps that merely *depend on*
> `@aceshooting/lyra-ui` — that's `packages/lyra-ui/llms.txt` (short index) and
> `packages/lyra-ui/llms-full.txt` (full API reference). Don't confuse the two.

## What this is

`@aceshooting/lyra-ui` (v0.1.1) is a free, clean-room Lit 3 web-component library — an
open-source companion to Web Awesome that reimplements several Web Awesome **Pro**
components plus original extras. Positioning, non-negotiable:

- **Clean-room.** No Web Awesome Pro source was ever available or copied. Behavior is
  implemented originally, seeded only from this org's own pre-existing hand-rolled
  components (named per-task in the plan docs under `docs/superpowers/plans/`).
- **API-mirroring method.** For components that *do* have a Web Awesome counterpart, the
  public surface (attributes, slots, events, parts, CSS custom properties) is mirrored 1:1
  under the `lyra-` prefix — migration is a mechanical `wa-` → `lyra-` rename. Components
  with no WA equivalent (most of Tier 1–3 and the "bigger own tracks") instead follow this
  library's own established conventions (see below) — there is no docs page to mirror.
- **Non-goals** (see the design spec, §3): not a WA fork, no `wa-` prefix or WA
  trademark/branding, no React wrappers (stack is unifying on Lit; custom elements work in
  React 19 anyway), Video/Video-Playlist deferred indefinitely.
- Full rationale, goals, and the v1 API tables: `docs/superpowers/specs/2026-07-07-lyra-ui-component-library-design.md`.

## Monorepo layout

pnpm workspace (`pnpm-workspace.yaml`: `packages/*`), Node ≥ 20, `pnpm@11.10.0`.

```
lyra-ui/                          (repo root — this file lives here)
  packages/
    lyra-ui/                      @aceshooting/lyra-ui — the library itself
      src/
        internal/                 LyraElement base, FormAssociated mixin, Floating UI
                                   positioner, design tokens (tokens.styles.ts), prefix.ts, a11y.ts
        components/<name>/        one dir per component family (see README's component table)
        lyra.ts                   barrel: side-effect imports (registers every tag) + re-exports
      llms.txt / llms-full.txt    CONSUMER-facing API reference (not this file's audience)
    lyra-flags/                   optional companion pkg — waving flag SVGs for <lyra-flag>,
                                   kept out of lyra-ui's default install (vendored from Noto
                                   Emoji, Public Domain — see its THIRD_PARTY_NOTICES.md)
  docs/                           Vite playground demoing every component (this pkg + lyra-flags)
    superpowers/
      specs/                      spec docs (design spec, post-audit roadmap addendum)
      plans/                      tier/feature implementation plans (see SDD Process below)
  .superpowers/sdd/                 execution ledger + audit reports (progress.md, audit reports)
```

## Dev commands (run from repo root unless noted)

```bash
pnpm install                # workspace install
pnpm build                  # -r: tsc -p tsconfig.json per package -> dist/ (ESM + .d.ts)
pnpm test                   # -r: @web/test-runner (wtr) per package
pnpm lint                   # -r: tsc --noEmit per package
pnpm manifest               # --filter @aceshooting/lyra-ui: cem analyze -> custom-elements.json
pnpm docs                   # Vite playground (docs/vite.config.ts), demos every component live
```

Package-local equivalents (from `packages/lyra-ui/`): `pnpm test:watch` also exists. CI
(`.github/workflows/ci.yml`) runs, in order: install --frozen-lockfile, Playwright Chromium
install, lint, test, build, manifest — reproduce failures locally with the same sequence.

## Coding conventions (every component follows these — deviating needs a strong reason)

- **Extend `LyraElement`** (`src/internal/lyra-element.ts`), not `LitElement` directly. It
  supplies the token CSS layer (`static styles = [tokens]`) and `this.emit()`.
- **Never hard-code `"lyra-"`.** Tag names go through `tag(name)` / register via
  `defineElement(name, ctor)` from `src/internal/prefix.ts` (idempotent — safe to import
  twice). The prefix is a single constant (`LYRA_PREFIX`) so a rename stays cheap.
- **Design tokens only.** Every color/space/font/radius value in a component's styles must
  reference a `--lyra-*` custom property already defined in `src/internal/tokens.styles.ts`,
  which itself falls back through `var(--wa-*-token, <hardcoded-default>)` — e.g.
  `--lyra-color-brand: var(--wa-color-brand-fill-loud, #0969da);`. This is what makes
  components look native inside a Web Awesome app while still rendering sensibly standalone.
  No raw hex/px design values in component styles, except where an algorithm genuinely
  requires a literal (e.g. gauge sweep-angle math) — and even then, expose the literal as a
  retheme-able `--lyra-*` custom property if it's data-driven (e.g. a color-ramp endpoint).
- **Events:** dispatch via `this.emit('lyra-whatever', detail)` (from `LyraElement`) — never
  `dispatchEvent(new CustomEvent(...))` directly. This guarantees `bubbles: true,
  composed: true, cancelable: true` and the `lyra-` event-name prefix.
- **Sibling `*.styles.ts` file** per component (e.g. `empty.styles.ts` exports `styles`), not
  inline `css` in the component file. Component sets `static styles = [LyraElement.styles, styles]`.
- **Granular, tree-shakeable exports.** Each component's `.ts` file is a side-effect-free
  class export; a matching side-effectful entry point registers the tag. `src/lyra.ts` is the
  barrel — side-effect imports for every component (registers all tags) plus named
  re-exports of classes/types/helpers. `package.json#exports` maps `.`, `./components/*`,
  `./internal/*`; `sideEffects` is scoped to `**/components/**/*.js` and `dist/lyra.js` only —
  keep new components' plain class modules free of top-level side effects or tree-shaking
  breaks for every consumer.
- **Form-associated controls** use the `FormAssociated` mixin (`src/internal/form-associated.ts`,
  built on `ElementInternals`) — known gap (see Current status below): it never calls
  `internals.setValidity()`, so `required` is currently a no-op for constraint validation on
  every form-associated component. Don't copy that gap into new components without flagging it.
- **JSDoc header** on the component class: `@customElement lyra-x`, `@slot`, `@csspart` tags
  (see any existing component, e.g. `components/empty/empty.ts`) — this feeds the generated
  manifest and the consumer-facing docs.
- License: MIT. TypeScript strict.

## Testing conventions

- **Stack:** `@web/test-runner` (`wtr`) + `@web/test-runner-playwright` (Chromium launcher) +
  `@open-wc/testing` (`fixture`, `expect`, `oneEvent`, and axe accessibility assertions via
  `expect(el).to.be.accessible()`).
- **TDD, failing-test-first.** Every behavior change starts with a test that fails for the
  right reason, per `superpowers:test-driven-development`. Commit after each green step.
- Test files are colocated siblings: `components/<name>/<name>.test.ts`.
- Run via `pnpm test` from repo root (fans out to every package) or `packages/lyra-ui/` for
  just this package; `pnpm test:watch` for iteration.
- Known test-writing pitfall (recurred across multiple plan docs' own sample code, always
  fixed the same way): calling `oneEvent()` *after* a synchronous `dispatchEvent()` races and
  hangs — always set up the `oneEvent()` listener *before* triggering the dispatch.
- Every component gets at least one `it('is accessible', ...)` axe check in addition to
  behavior tests.

## SDD process (spec -> plan -> task cycle) for multi-step work

This repo's non-trivial work (a new tier of components, a hardening pass, etc.) follows the
`superpowers` skill family's spec-driven-development flow, evidenced by
`.superpowers/sdd/progress.md`:

1. **Spec** (`docs/superpowers/specs/YYYY-MM-DD-*.md`) — goals, non-goals, naming, success
   criteria. Written/approved before any implementation plan.
2. **Plan** (`docs/superpowers/plans/YYYY-MM-DD-*.md`) — one plan doc per tier/feature batch.
   Each opens with a **"REQUIRED SUB-SKILL"** callout naming which skill to execute it with
   (`superpowers:subagent-driven-development` recommended, or `superpowers:executing-plans`),
   then a **Global Constraints** section (prefix rule, clean-room rule, token rule, event
   rule, TDD rule — matching the Coding Conventions above), then numbered tasks with
   checkbox (`- [ ]`) steps, file lists, and interfaces.
3. **Per-task cycle**, run via `superpowers:subagent-driven-development`: a
   task-N-brief.md is handed to an implementer subagent, which produces a
   task-N-report.md; a separate reviewer subagent checks spec compliance and quality; fix
   rounds repeat until clean. This is why `.superpowers/sdd/progress.md` records, per task,
   the commit range and "review clean after N fix rounds" plus exactly what each fix round
   found.
4. **Ledger**: `.superpowers/sdd/progress.md` is the running execution log across the whole
   roadmap — tier by tier, task by task, with commit ranges, fix-round counts, and root
   causes. Read it in full before starting new SDD work so you don't re-litigate settled
   decisions or duplicate a fix already applied elsewhere.

When picking up new multi-step work in this repo, use `superpowers:writing-plans` to turn a
spec into a plan doc first, then `superpowers:subagent-driven-development` (preferred) or
`superpowers:executing-plans` to run it, and append to `progress.md` as you go.

## Current status & what's next

**Internally code-complete, adoption unvalidated.** As of commit `fd7a032`: 198/198 tests
green, all 34 custom-element tags present in a freshly regenerated `custom-elements.json`,
lint/build/manifest all pass. But the design spec's own Section 9 success criterion — prove
value by replacing a real hand-rolled component in a consumer repo — is **0-for-5**: all
five swap attempts named across the roadmap and later plan docs ([client]'s
`[component]`, `[client]`'s `[Component]`, `[client]`'s
`[component].ts`, `[client]`'s `[Component].tsx`, and [client]'s
`[component]`/`[component].ts`) remain unattempted. A separate five-project survey
([client], [client], [client], [client], [client]) independently confirms zero
adoption of `@aceshooting/lyra-ui` anywhere. "Roadmap complete" should not be read as
"goal achieved" — see these artifacts before starting new work:

- Full findings: `.superpowers/sdd/2026-07-10-cross-repo-audit-report.md` — executive summary
  (lines 3–11), roadmap/plan status + every verified known issue (lines 16–47), per-component
  improvement opportunities across all 20 component directories incl. the High-severity
  shared `FormAssociated.setValidity()` gap (lines 50–234), per-project survey findings
  (lines 238–290), an 18-item missing-components wishlist ranked by cross-project signal
  (lines 292–402), and recommended next steps ranked by impact (lines 405–414).
- Roadmap addendum (post-audit plan of record):
  `docs/superpowers/specs/2026-07-10-lyra-ui-post-audit-roadmap.md`.
- Two new implementation plans queued from the audit:
  `docs/superpowers/plans/2026-07-10-lyra-ui-tier4-hardening.md` (fixes for the known
  issues/accessibility gaps) and
  `docs/superpowers/plans/2026-07-10-lyra-ui-tier5-priority-features.md` (top wishlist items).

Before adding new components or features, check whether the audit already covers the gap —
duplicating analysis there wastes a review cycle.
