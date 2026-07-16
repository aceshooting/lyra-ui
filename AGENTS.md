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

Package-local equivalents (from `packages/lyra-ui/`): `pnpm test:watch` also exists. The `build-test`
job in `.github/workflows/ci.yml` is the authoritative gate list and reproduction sequence — it
currently runs install --frozen-lockfile, Playwright Chromium install, lint, **build, then test**
(a `pnpm --filter '!@aceshooting/lyra-ui' -r test` step, which covers every other workspace package,
e.g. lyra-flags's own test script), then `test:coverage` — the one time lyra-ui's own Chromium suite
actually runs, since a separate `pnpm test` step would just re-run the identical file set a second
time with coverage instrumentation off (build must precede `test:coverage`:
`src/package-entrypoints.test.ts` dynamically imports the published `./dist/lyra.js` entry points,
which only exist after a build), `manifest`, a `git diff --exit-code` check on
`custom-elements.json` (the freshness check — a standalone `manifest:check` step would be redundant
with this), `readme:check`, `docs:build`, `storybook:check`, `storybook:check-theme`, a `pnpm
--filter @aceshooting/lyra-ui pack --dry-run` check that the published tarball still contains
`custom-elements.json`/`llms.txt`/`llms-full.txt`, then `check:packed-consumer`. A separate
`platform-contracts` matrix job runs the platform contract suite (`test:platform`) against
Firefox/WebKit on Node 20/22. Read the workflow file directly rather than trusting a restated list
here, which will drift as steps are added — reproduce a CI failure locally by running the same
commands in the same order.

## Coding conventions (every component follows these — deviating needs a strong reason)

- **Extend `LyraElement`** (`src/internal/lyra-element.ts`), not `LitElement` directly. It
  supplies the token CSS layer (`static styles = [tokens]`) and `this.emit()`.
- **Never hard-code `"lyra-"`.** Tag names go through `tag(name)` / register via
  `defineElement(name, ctor)` from `src/internal/prefix.ts` (idempotent — safe to import
  twice). The prefix is a single constant (`LYRA_PREFIX`) so a rename stays cheap.
- **Design tokens only.** Every color/space/font/radius value in a component's styles must
  reference a `--lyra-*` custom property already defined in `src/internal/tokens.styles.ts`,
  which itself falls back through `var(--lyra-theme-*-token, <hardcoded-default>)` — e.g.
  `--lyra-color-brand: var(--lyra-theme-color-brand-fill-loud, #0969da);`. This is what lets a
  consumer retheme the whole library by overriding one `--lyra-theme-*` property per token at
  any ancestor, while every component still renders sensibly with zero configuration.
  No raw hex/px design values in component styles, except where an algorithm genuinely
  requires a literal (e.g. gauge sweep-angle math) — and even then, expose the literal as a
  retheme-able `--lyra-*` custom property if it's data-driven (e.g. a color-ramp endpoint).
- **Events:** dispatch custom events through `this.emit(name, detail, options)` (from
  `LyraElement`) — never `dispatchEvent(new CustomEvent(...))` directly. `emit()` guarantees
  `bubbles: true` and `composed: true`; notifications are deliberately non-cancelable unless the
  operation is a real veto point and passes `{ cancelable: true }`. The helper does **not** rename
  the event: use native-style `input`/`change` only when mirroring a native/form-control contract,
  and name library-specific events explicitly with the `lyra-` prefix. Direct dispatch is reserved
  for the rare wrapper that must preserve a native `Event`/`InputEvent` instance rather than turn it
  into a `CustomEvent`. Keep the component event-map type, class JSDoc, tests, stories, and consumer
  reference aligned with the exact names and details.
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

## Internationalization (i18n), RTL, and theming

Every component ships with the same three guarantees baked in: any user-facing string can be
translated, layout doesn't break under a right-to-left language, and the whole visual surface
retheme through design tokens. These are cross-cutting — verified across every component, not
opt-in per component — so treat a gap in any of them as a bug, not a missing feature.

**i18n — `this.localize(key, fallback, values)`:**

- Every user-facing string — visible text, `aria-label`/`aria-description`, `title`,
  `placeholder`, `alt` — routes through `this.localize()` (`LyraElement`, backed by
  `src/internal/localization.ts`). Never hard-code an English UI string directly in a template.
  Exception: content that's inherently caller-supplied data (file names, arbitrary API/user
  text, `Intl`-formatted numbers/dates) isn't an i18n concern — don't route data through
  `localize()`, only the library's own copy.
- Message keys live in `localization.ts`'s `LyraMessageKey` union + `DEFAULT_STRINGS`. **Reuse
  an existing key before adding a new one** — grep `DEFAULT_STRINGS` first — but don't force a
  reuse where the wording is genuinely different (a component-specific key with a component-name
  prefix, e.g. `dockPanelResize`, `chartTrendIncreasing`, beats bending an unrelated generic key
  like `noData` to a different literal string; see the next bullet for why the fallback text
  must still match whatever `DEFAULT_STRINGS` says for that key).
- **Never pass a literal, unconditional fallback string as the 2nd argument once the key already
  has a `DEFAULT_STRINGS` entry.** `resolveLyraString()` resolves `this.strings` overrides, then
  a *defined* `fallback` argument, and only checks `registerLyraLocale()`-registered translations
  when both of those are `undefined` — so `this.localize('close', 'Close')` silently defeats
  translation for that call site forever, even though it renders correctly in English. Call it
  bare instead: `this.localize('close')`. The one legitimate reason to pass a fallback is when
  it's *conditionally* derived from a public property a consumer might have explicitly
  customized away from its built-in default, so an explicit override still wins verbatim while
  the unmodified case still resolves through the registry:
  `this.localize('previousMonth', this.previousLabel === 'Previous month' ? undefined : this.previousLabel)`.
  Passing `this.someProp` unconditionally has the same bug as a literal — it always short-circuits
  the registry unless the prop happens to be empty/`undefined`. This is the single easiest-to-introduce
  regression in the library and nothing in `scripts/` catches it — no policy script greps for
  `this.localize('key', 'literal'` — so it is enforced by code review only. Watch for it explicitly
  when reviewing a `localize()` call site, don't assume a CI gate already exists.
- Interpolate via the 3rd `values` argument with `{placeholder}` syntax matching the
  `DEFAULT_STRINGS` template, e.g. `this.localize('showMoreCount', undefined, { count })` for
  `'Show {count} more'` — never string-concatenate translated text with data.
- Test convention: at minimum, one test proves the built-in English fallback renders unchanged
  with no locale registered; for any component whose behavior depends on a key showing up
  correctly, add a `.strings` override test (e.g. `.strings=${{ someKey: 'Texte' }}`) that proves
  the string actually reaches the DOM — a key existing in the union doesn't prove the call site
  is wired up correctly.

**RTL — logical properties, not a forced `dir`:**

- Components never set their own `dir` attribute. Direction is inherited from the nearest
  ancestor `dir`/`lang` (or computed style) via `resolveLyraDirection()` /
  `this.effectiveDirection` (`'ltr' | 'rtl'`).
- Prefer CSS logical properties over physical ones in every component stylesheet: `inset-inline-
  start`/`inset-inline-end` (not `left`/`right`), `margin-inline-start`/`margin-inline-end` (not
  `margin-left`/`margin-right`), `padding-inline-*` (not `padding-left`/`padding-right`),
  `border-inline-start`/`border-inline-end`, `text-align: start`/`text-align: end` (not
  `left`/`right`). Logical properties auto-mirror under `dir="rtl"` with zero JS; physical ones
  silently don't. `:host(:dir(rtl))` is the escape hatch for the rare case that genuinely needs
  an explicit override (e.g. flipping a directional chevron's rotation).
- Keyboard navigation that treats `ArrowLeft`/`ArrowRight` as "previous"/"next" (day-grids,
  roving-tabindex column nav, carousel-style controls) must consult `this.effectiveDirection`
  and swap which arrow means which under RTL — a plain `ArrowLeft === previous` hardcode is an
  RTL bug, not just an LTR-only shortcut. This was the single most common RTL miss found in this
  library's own standardization pass (graph, heatmap, word-cloud roving-focus nav).
- A directional glyph (a chevron/arrow meaning "expand toward", "previous", "next") must mirror
  under RTL. Rotate the wrapping `part` element via `:host(:dir(rtl)) [part='x'] { transform: ... }`
  rather than baking a fixed rotation into the icon itself.

**Theming — design tokens only:** see "Design tokens only" under Coding conventions above — every
color/space/font/radius value must reference a `--lyra-*` custom property from
`internal/tokens.styles.ts`, which bridges to lyra's own `--lyra-theme-*` custom properties with a
hardcoded fallback. This is what makes both i18n and RTL "just work" visually too: token-driven spacing and
sizing don't hardcode a text direction or a font's natural width, so translated strings (which run
longer or shorter than English) and mirrored RTL layouts both reflow correctly without a component-
specific override.

## Form-control completeness and native passthrough

Four more cross-cutting guarantees, verified across every component that structurally has the
surface in question — a gap in an applicable component is a bug, not a missing feature. Not every
item applies to every component; each is scoped to the component shapes described below.

- **Label/hint/error chrome.** Any form-associated control (the `FormAssociated` mixin, or a
  hand-rolled `ElementInternals` attachment like `lyra-select`/`lyra-combobox`) ships `label`/
  `hint`/`errorText` props, matching `label`/`hint`/`error` named slots, and `form-control`/
  `form-control-label`/`hint`/`error` CSS parts — mirroring `lyra-select`'s template structure
  (required-asterisk `::after`, `hasLabelSlot`/`hasHintSlot`/`hasErrorSlot` tracked in JS since
  `[part]:empty` never matches a slot-containing part, `aria-describedby` wired to the rendered
  hint/error ids). The one exception is a control whose own doc comment explicitly states it's a
  deliberately bare primitive with no chrome, or whose interaction idiom is genuinely incompatible
  with a generic label/hint/error frame (e.g. a slider's `label` is an accessible-name override,
  not visible text; a chat composer is a composite input, not a labeled field) — silence isn't an
  exception on its own, a component relying on this carve-out states it explicitly in its class doc
  comment the next time that component is touched.
- **ARIA-name forwarding.** Any component that computes its own internal accessible name must let
  a host-level `aria-label` win over that computed default. Two established patterns, pick
  whichever fits the component's own label sources: an `accessibleLabel` property
  (`@property({ attribute: 'aria-label' })`, `lyra-date-input`'s pattern) when the component
  already has other label sources (a `label` prop, a placeholder) to arbitrate against in a
  specific precedence order, or a plain `this.getAttribute('aria-label')` fallback
  (`lyra-slider`'s pattern) when there's nothing else to arbitrate against.
- **Resize forwarding.** Any component wrapping a native resizable text-editing surface exposes
  the same resize vocabulary the native element supports, including auto-grow-to-content — or its
  doc comment explicitly states the omission (e.g. a fixed-size-by-design surface).
- **Editing-assistance and event-bridging passthrough.** Any component with an internal native
  `<input>`/`<textarea>` forwards `spellcheck`/`autocapitalize`/`autocorrect`/`wrap` (whichever
  apply to that input's `type`), and re-dispatches the internal element's `blur`/`focus` as
  bubbling, composed events via `this.emit('blur')`/`this.emit('focus')` — native `blur`/`focus`
  neither bubble nor cross a shadow boundary, so a host-level listener on the custom element itself
  never sees them otherwise.

## Accessibility, native control contracts, responsive layout, and motion

These guarantees are cross-cutting in the same way as i18n, RTL, and theming. Treat a gap as a bug
in an existing component and as a release blocker for a new component.

**Shadow-DOM semantics — name the element that owns the role:**

- Putting `aria-label` on a custom-element host does not name a textbox, radiogroup, listbox,
  dialog, or other semantic element rendered inside its shadow root. If the role lives on an
  internal element, expose an explicit naming property and deliberately forward a host
  `aria-label` when that is part of the component's public contract. Apply the final name to the
  element that actually owns the role.
- `aria-labelledby`/`aria-describedby` ids do not become valid merely because the same string is
  copied across a shadow boundary. Generated visible labels, hints, and errors should live in the
  same shadow tree as the control they describe and use stable generated ids. If external
  labelling elements are supported, implement that relationship deliberately (for example through
  the appropriate `ElementInternals` element-reference API); never forward an unresolved idref.
- Once a semantic role opts into a state, render both values explicitly: a toggle button has
  `aria-pressed="true"` or `"false"`, a selectable option has `aria-selected="true"` or `"false"`,
  and an expandable control has `aria-expanded="true"` or `"false"` while it is expandable.
  Removing the attribute for the false case changes the exposed control contract.
- A decorative icon is `aria-hidden="true"`; an icon-only action needs a localized accessible
  name. Visible labels and richer spoken labels are separate public concerns — expose an
  `accessibleLabel`-style override when forcing detailed assistive text into the visible label
  would be wrong.

**Native-control wrappers — preserve the useful native contract:**

- A component wrapping an `<input>`, `<textarea>`, `<select>`, or similar element forwards the
  native attributes that are meaningful for its advertised use: for example `autocomplete`,
  `inputmode`, `enterkeyhint`, `spellcheck`, `autocapitalize`, `autocorrect`, and `wrap`. Do not add
  every platform attribute blindly, but do not make a common native behavior impossible through
  encapsulation either.
- Expose the focus, selection, and editing surface consumers reasonably need from the wrapped
  control. For text controls that normally includes `focus()`/`blur()`, `select()`, selection
  getters, `setSelectionRange()`, `setRangeText()`, or a documented public getter for the native
  element. Public methods must keep the component's reactive `value`, form value, and validity in
  sync.
- Specify event names, detail, timing, cancelability, and programmatic-update behavior before
  implementation. User edits should remain observable outside the shadow root. If a native event
  does not bubble or compose (`blur` is the common trap), bridge it intentionally when the mirrored
  public contract promises host-level observation. Programmatic property assignments remain silent
  unless the component explicitly documents otherwise.
- Form-associated wrappers must project `name`, disabled state, reset/default behavior, and
  constraint validity through `ElementInternals`; rendering `required` on a private native control
  alone is not sufficient.

**Responsive components — respond to allocation, not page assumptions:**

- Reusable primitives must work in a narrow panel, split pane, dialog, and full page. Prefer
  logical sizes, `min-inline-size: 0`, intrinsic wrapping/overflow, and container queries tied to
  the component's own allocation. A viewport media query is appropriate only for an explicit
  app-shell/viewport component.
- Any component with a multi-column, label-plus-actions, toolbar, or potentially long translated
  layout gets a narrow-allocation story/test (320px is a useful baseline) and a long-content case.
  A wide desktop canvas is not sufficient responsive evidence.

**Motion — durations and phases form one themeable system:**

- Animation durations, delays, stagger phases, and transition timing must use shared tokens or
  component custom properties that can be overridden coherently. If a compound token cannot be
  divided with `calc()`, expose the dependent delay/phase values instead of leaving magic literals.
- Decorative, ambient, and infinite animation must stop or simplify under
  `prefers-reduced-motion: reduce`. User-controlled spatial feedback may remain when removing it
  would obscure the interaction, but it should not add nonessential easing or repeated motion.
- Test the reduced-motion branch for animation-heavy components and test that documented motion
  custom properties actually reach the rendered animation declarations.

**Public API documentation — one change, one synchronized surface:**

- A public property, type, method, getter, event, slot, CSS part, or custom property is incomplete
  until the class JSDoc, behavior tests, an illustrative Storybook story, `llms-full.txt`, and the
  generated `custom-elements.json` agree. Update the package/root component catalog when the
  component count or summary changes, and update exports for new public types/helpers.
- Run `pnpm manifest` after JSDoc/API changes and inspect the generated diff. A passing TypeScript
  build does not catch stale stories, prose, CSS-part lists, or a missing manifest entry.

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
- For a role/control inside shadow DOM, assert accessible-name/state attributes on the actual
  semantic descendant as well as running axe. Include the false state for stateful ARIA and prove
  that any public host naming path reaches that descendant.
- Native-wrapper tests cover relevant attribute forwarding, form/reset/validity behavior, public
  focus/editing methods, and the exact bubbling/composed event contract. Do not treat a rendered
  private native element as proof that the host API works.
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
