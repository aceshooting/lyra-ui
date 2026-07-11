# AGENTS.md — contributor guide for AI coding agents working ON this repo

> **Scope note:** this file is for agents (Claude Code, Codex, etc.) modifying lyra-ui's own
> source. It is NOT the consumer-facing API reference for apps that merely *depend on*
> `@aceshooting/lyra-ui` — that's `packages/lyra-ui/llms.txt` (short index) and
> `packages/lyra-ui/llms-full.txt` (full API reference). Don't confuse the two.

## What this is

`@aceshooting/lyra-ui` (see `packages/lyra-ui/package.json` for the current published version) is
a free, clean-room Lit 3 web-component library — an
open-source companion to Web Awesome that reimplements several Web Awesome **Pro**
components plus original extras. Positioning, non-negotiable:

- **Clean-room.** No Web Awesome Pro source was ever available or copied. Behavior is
  implemented originally, seeded only from this org's own pre-existing hand-rolled
  components.
- **API-mirroring method.** For components that *do* have a Web Awesome counterpart, the
  public surface (attributes, slots, events, parts, CSS custom properties) is mirrored 1:1
  under the `lyra-` prefix — migration is a mechanical `wa-` → `lyra-` rename. Components
  with no WA equivalent (most of Tier 1–3 and the "bigger own tracks") instead follow this
  library's own established conventions (see below) — there is no docs page to mirror.
- **Non-goals:** not a WA fork, no `wa-` prefix or WA trademark/branding, no React wrappers
  (stack is unifying on Lit; custom elements work in React 19 anyway), Video/Video-Playlist
  deferred indefinitely.

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
  built on `ElementInternals`) — known gap: it never calls
  `internals.setValidity()`, so `required` is currently a no-op for constraint validation on
  every form-associated component. Don't copy that gap into new components without flagging it.
- **JSDoc header** on the component class: `@customElement lyra-x`, `@slot`, `@csspart` tags
  (see any existing component, e.g. `components/empty/empty.ts`) — this feeds the generated
  manifest and the consumer-facing docs.
- **Never reference internal process in code comments or shipped docs.** Comments, JSDoc, and
  the `llms.txt`/`llms-full.txt` reference must not cite internal audits or design reviews,
  plan/spec/ledger docs, task or tier codenames (`§lyra-*`, `"dashboard-atoms"`, `Task 3`),
  audit severity ratings (`High`/`Medium`/`Low`), dated review findings, client/project names,
  or adoption/"battle-tested" status. This source ships verbatim in the public npm tarball
  (`dist/`, `custom-elements.json`, `llms*.txt` all carry these comments), so anything written
  here is published. Keep the *technical* rationale ("previously X was broken, so we do Y") and
  drop the provenance — a code comment explains the code, not who reviewed it.
- License: MIT. TypeScript strict.

## Testing conventions

- **Stack:** `@web/test-runner` (`wtr`) + `@web/test-runner-playwright` (Chromium launcher) +
  `@open-wc/testing` (`fixture`, `expect`, `oneEvent`, and axe accessibility assertions via
  `expect(el).to.be.accessible()`).
- **TDD, failing-test-first.** Every behavior change starts with a test that fails for the
  right reason. Commit after each green step.
- Test files are colocated siblings: `components/<name>/<name>.test.ts`.
- Run via `pnpm test` from repo root (fans out to every package) or `packages/lyra-ui/` for
  just this package; `pnpm test:watch` for iteration.
- Known test-writing pitfall (recurred across multiple plan docs' own sample code, always
  fixed the same way): calling `oneEvent()` *after* a synchronous `dispatchEvent()` races and
  hangs — always set up the `oneEvent()` listener *before* triggering the dispatch.
- Every component gets at least one `it('is accessible', ...)` axe check in addition to
  behavior tests.

## Process for multi-step work

This repo's non-trivial work (a new tier of components, a hardening pass, etc.) follows a
spec -> plan -> task execution cycle: a spec (goals, non-goals, naming, success criteria) is
written and approved before any implementation plan; the plan breaks the work into numbered
tasks with checkbox steps, file lists, and interfaces; each task is implemented then reviewed
for spec compliance and quality, with fix rounds repeating until clean. These working docs
(specs, plans, execution ledger) are intentionally kept out of version control — they aren't
tracked in this repository.
