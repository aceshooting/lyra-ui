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
  .storybook/                     Storybook config — the docs site (this pkg + lyra-flags)
```

## Dev commands (run from repo root unless noted)

```bash
pnpm install                # workspace install
pnpm build                  # -r: tsc -p tsconfig.json per package -> dist/ (ESM + .d.ts)
pnpm test                   # -r: @web/test-runner (wtr) per package
pnpm lint                   # -r: tsc --noEmit per package
pnpm manifest               # --filter @aceshooting/lyra-ui: cem analyze -> custom-elements.json
pnpm docs                   # Storybook (.storybook/), demos every component live at localhost:6006
```

Package-local equivalents (from `packages/lyra-ui/`): `pnpm test:watch` also exists. CI
(`.github/workflows/ci.yml`) runs, in order: install --frozen-lockfile, Playwright Chromium
install, lint, test, build, manifest, then a `pnpm --filter @aceshooting/lyra-ui pack --dry-run`
check that the published tarball still contains `custom-elements.json`/`llms.txt`/`llms-full.txt`
— reproduce failures locally with the same sequence.

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
  `./internal/*`; `sideEffects` is scoped to component modules — both compiled
  (`**/components/**/*.js`) and source (`**/components/**/*.ts`) — and the barrel, again both
  compiled (`./dist/lyra.js`) and source (`./src/lyra.ts`). The `.ts` patterns matter because
  Storybook's production build (`pnpm docs:build`, i.e. the live docs site) imports `src/*.ts`
  directly rather than `dist/`; without them Rollup can't match those source files against the
  side-effects globs and tree-shakes away every side-effect-only component import, so no
  `<lyra-*>` element ever registers on the deployed site. Keep new components' plain class
  modules free of top-level side effects or tree-shaking breaks for every consumer.
- **Form-associated controls** use the `FormAssociated` mixin (`src/internal/form-associated.ts`,
  built on `ElementInternals`) where the value fits a plain string (`lyra-date-input`); it calls
  `internals.setValidity()` so `required` participates in native constraint validation
  (`checkValidity()`/`reportValidity()`/`:invalid`). Components whose value isn't a single string
  (e.g. `lyra-combobox`'s multi-select array) attach `ElementInternals` directly instead of using
  the mixin, but must still call `setValidity()` themselves — see `combobox.ts`'s
  `updateValidity()` for the pattern.
- **JSDoc header** on the component class: `@customElement lyra-x`, `@slot`, `@csspart` tags
  (see any existing component, e.g. `components/empty/empty.ts`) — this feeds the generated
  manifest and the consumer-facing docs.
- **Never reference internal process in code comments or shipped docs.** Comments, JSDoc, and
  the `llms.txt`/`llms-full.txt` reference must not cite internal audits or design reviews,
  plan/spec/ledger docs, internal task/tier/project codenames, section-mark (`§`) references,
  audit severity ratings (`High`/`Medium`/`Low`), dated review findings, client/project names,
  local filesystem paths, or adoption/"battle-tested" status. This source ships verbatim in the
  public npm tarball (`dist/`, `custom-elements.json`, `llms*.txt` all carry these comments), so
  anything written here is published. Keep the *technical* rationale ("previously X was broken,
  so we do Y") and drop the provenance — a code comment explains the code, not who reviewed it.
  Local-only planning/agent-tooling directories must never be referenced by path — by name or
  otherwise — from any tracked file, and must stay untracked via local git exclude config rather
  than the committed `.gitignore` (which would itself name them).
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
- **A failed `expect(x).to.equal(y)` where `x`/`y` are DOM elements can hang the whole test file**
  under `wtr`'s Playwright-controlled browser (chai/loupe's diff-formatting for a DOM node appears
  to deadlock the automated reporting pipeline specifically — the same assertion fails instantly
  and prints normally in a plain, uncontrolled browser tab). The file reports `0 passed, 0 failed`
  and times out at `testsFinishTimeout` with no per-test detail, which reads exactly like an
  unrelated environment/resource-contention issue and is easy to misdiagnose as one. If a test file
  hangs with no informative output: bisect it (binary-split the `it()` blocks into scratch files
  until you isolate the one test), then either fix the underlying wrong expectation or restructure
  the assertion to compare something other than the DOM elements directly (e.g. an id/attribute).
  Two concrete traps that produce this: comparing `document.activeElement` against an element that
  actually lives inside a shadow root (`document.activeElement` never drills into an *open* shadow
  root — compare against `theHost.shadowRoot.activeElement` instead, walking one `.shadowRoot`
  level per nesting depth); and asserting `outerShadowRoot.activeElement` equals an element that is
  itself nested *two* shadow roots deep (an outer component's own `shadowRoot.activeElement` only
  resolves as far as the *host* of a further-nested shadow tree, never the real focused descendant
  inside it — only `document.activeElement` walked all the way down, or a component's own
  shadow-piercing `getActiveElement()`-style helper, sees the true target).
- **A `?bool-attr=${false}` (or a literal `bool-attr="false"`) binding can never set a reactive
  boolean property back to `false` once that property's own default is `true`** — Lit's boolean-
  attribute binding only *toggles the attribute's presence*, and removing an attribute that was
  never present in the first place fires no `attributeChangedCallback`, so the property stays at
  its constructor default. The only way to assign `false` to a `true`-defaulting boolean property
  from a template is a **property** binding: `.boolProp=${false}`. This bit both a shipped
  component's own test suite and its Storybook stories in this family (search for `submitOnEnter`/
  `editable` in `git log` for the two real instances) — grep for `?` bindings against any property
  whose class-field default is `true` before trusting a `?attr=${false}` test setup at face value.
- `@sinonjs/fake-timers` is a `devDependency` but **does not currently work in this test
  environment** — it's CJS-only with no ESM build and no browser `exports` condition, so importing
  it throws `ReferenceError: require is not defined` under `wtr`'s esbuild-based pipeline (unlike
  `hammerjs`/`maplibre-gl`, no CJS-interop shim exists for it in `web-test-runner.config.js`).
  Timer/interval-driven components (stall detection, coalescing, elapsed-time ticks) use real
  timers with short, generously-margined thresholds instead — see `stream-status.test.ts` or
  `generation-status.test.ts` for the pattern. Fixing this properly (adding a shim, or swapping to
  an ESM-compatible fake-timer library) is open — do it if a future test genuinely can't be written
  reliably with real timers, but don't reach for `@sinonjs/fake-timers` assuming it already works.

## Process for multi-step work

This repo's non-trivial work (a new tier of components, a hardening pass, etc.) follows a
spec -> plan -> task execution cycle: a spec (goals, non-goals, naming, success criteria) is
written and approved before any implementation plan; the plan breaks the work into numbered
tasks with checkbox steps, file lists, and interfaces; each task is implemented then reviewed
for spec compliance and quality, with fix rounds repeating until clean. These working docs
(specs, plans, execution ledger) are intentionally kept out of version control — they aren't
tracked in this repository.
