# Coding conventions — lyra-ui agent reference

> Detail behind the "Coding conventions" digest in [AGENTS.md](../../AGENTS.md). Every component
> follows these — deviating needs a strong reason.

- **Extend `LyraElement`** (`src/internal/lyra-element.ts`), not `LitElement` directly. It
  supplies the token CSS layer (`static styles = [tokens]`) and `this.emit()`.
- **Never hard-code `"lr-"`.** Tag names go through `tag(name)`; register via
  `defineElement(name, ctor)` (`src/internal/prefix.ts`, idempotent — safe to import twice). The
  prefix is a single constant (`LYRA_PREFIX`) so a rename stays cheap.
- **Design tokens only.** Every color/space/font/radius value in component styles references a
  `--lr-*` custom property already defined in `src/internal/tokens.styles.ts`, which itself falls
  back through `var(--lr-theme-*-token, <hardcoded-default>)` — e.g.
  `--lr-color-brand: var(--lr-theme-color-brand-fill-loud, #0969da);`. That lets a consumer
  retheme the whole library by overriding one `--lr-theme-*` property per token at any ancestor,
  while every component still renders sensibly with zero configuration. No raw hex/px design
  values, except where an algorithm genuinely requires a literal (e.g. gauge sweep-angle math) —
  and expose even that as a retheme-able `--lr-*` property when it's data-driven (e.g. a
  color-ramp endpoint).
- **Every `true`-defaulting boolean `@property` needs a custom converter.** Lit's default
  `type: Boolean` converter toggles on attribute *presence*, so plain `prop="false"` markup is
  indistinguishable from never setting the attribute — the property silently stays `true` for
  anyone not using a JS property binding. Use `trueDefaultBooleanConverter`, or a bespoke
  converter special-casing the literal string `'false'` (like `spellcheckConverter`). Grep
  `@property\([^)]*\)\s+[a-zA-Z]+\s*=\s*true;` for hits missing a `converter:` key. This is the
  authoring-side fix for the trap [testing.md](testing.md) describes from the test side; most of
  the library predates it, so add the converter when you touch such a property.
- **Numeric properties need a finite-number guard.** Any `@property({ type: Number })` whose
  value reaches layout math, an `Intl.*` constructor, canvas sizing, or a timer duration routes
  through `finiteNumber`/`finiteRange`/`finiteInteger`/`finiteCount`/`finiteDuration`
  (`src/internal/numbers.ts`) — never a bare `isNaN()` check (`isNaN(Infinity)` is `false`),
  never the raw property. An attribute or untyped JS caller can hand any string through
  regardless of the declared TypeScript type, and this bug class has shipped twice.
  `pnpm run check:numeric-guards` finds them; a genuine exception takes a
  `// numeric-guard-exempt: <reason>` comment.
- **Icon-sized hit targets.** Any `<button>`/`role="button"`/`tabindex="0"` element carrying a
  `part=` resolves its clickable box to at least `--lr-icon-button-size` via
  `min-inline-size`/`min-block-size` — a floor, not a fixed size, so larger slotted content still
  grows it. `pnpm run check:hit-area` checks this and honours a `hit-area-exempt` comment.
- **Never expose `rel` independently of `target`.** A property that can set a real anchor's
  `target` derives `rel="noopener noreferrer"` from that same value —
  `rel=${this.target ? 'noopener noreferrer' : nothing}`, as `app-rail-item.class.ts` does. A
  separately-settable `rel` means a consumer setting only `target="_blank"` gets an anchor with
  no `rel` at all — a live reverse-tabnabbing vector, not a style nit.
- **Resolve CSS colors before assigning `ctx.fillStyle`/`strokeStyle`.** Canvas 2D's setter is a
  spec'd silent no-op on an unparseable string: it keeps the previous value, usually black, with
  no error. Any canvas path deriving a color from a `--lr-*` property, a consumer callback, or a
  `color-mix()`/`var()` expression round-trips it through `getComputedStyle` into a concrete
  color first — `heatmap.class.ts`'s `resolveRgb()` and `graph.class.ts`'s
  `resolveCssColorValue()` are the patterns.
- **Resolve token units live; never hardcode `rem = 16px`.** A helper that reads a `--lr-*` size
  token via `getComputedStyle(...).getPropertyValue(...)` for layout or canvas math resolves the
  live pixel value for whatever unit the token carries —
  `getComputedStyle(document.documentElement).fontSize` for `rem`,
  `getComputedStyle(this).fontSize` for `em`. A hardcoded `* 16` gives systematically wrong
  geometry under a non-16px root font size, a common accessibility setting. `table.class.ts`'s
  `minimumResizeWidth()` is the reference; `mind-map.class.ts`'s `ringGapPx()` the
  counter-example.
- **Never re-namespace a custom element while cloning DOM.** Code walking slotted nodes into a
  different namespace (SVG-clone helpers, sanitizer round-trips) checks
  `node.localName.includes('-')` — or `customElements.get(...)` — before calling
  `createElementNS`: re-creating a custom element that way yields an inert node with the right
  tag name that never upgrades, silently. `lr-icon`'s `cloneSvgNode()` is the counter-example to
  avoid repeating.
- **Reconnect resets transient open-state.** A component owning floating-ui-positioned transient
  UI (open dropdown, hover preview, tooltip) resets the `@state()` boolean driving its visibility
  in `disconnectedCallback`, not just `cleanupPositioner` — otherwise a disconnect→reconnect
  cycle (drag-drop reparenting, virtualized-list reordering) leaves the popup rendered open at a
  stale, frozen position. `lr-combobox`/`lr-select`/`lr-date-input` do this correctly.
  `src/lifecycle-contracts.test.ts`'s reconnect smoke test only proves reconnect doesn't throw or
  leak — assert your component's open-state resumption in its own test.
- **Escape-dismissible / focus-returning overlays register through the shared overlay manager** —
  `activateOverlay()` (`src/internal/overlay-manager.ts`), never a hand-bound raw
  `document.addEventListener('keydown', ...)`. The manager coordinates stacking (only the
  top-most overlay reacts to Escape) and centralizes the focus-return contract; binding
  `document` directly reintroduces the exact stacking bug the manager exists to prevent.
- **Events** dispatch through `this.emit(name, detail, options)` (from `LyraElement`) — never
  `dispatchEvent(new CustomEvent(...))` directly. `emit()` guarantees `bubbles: true` and
  `composed: true`. Notifications are deliberately non-cancelable unless the operation is a real
  veto point and passes `{ cancelable: true }` — and the component must then actually branch on
  `event.defaultPrevented` before doing the thing it announced. A `cancelable: true` nothing
  consults is dead, misleading API surface — consumers will `preventDefault()` against it and
  quietly get nothing; no script checks this, so verify by hand whenever `cancelable: true`
  appears in a diff. `emit()` does not rename events: use native-style `input`/`change` only when
  mirroring a native/form-control contract, and name library-specific events explicitly with the
  `lr-` prefix. Direct dispatch is reserved for the rare wrapper that must preserve a native
  `Event`/`InputEvent` instance rather than turn it into a `CustomEvent`. Keep the component
  event-map type, class JSDoc, tests, stories, and consumer reference aligned with the exact
  names and details.
- **Sibling `*.styles.ts` file** per component (e.g. `empty.styles.ts` exports `styles`), not
  inline `css`; the component sets `static styles = [LyraElement.styles, styles]`.
- **Watch for silently-inert CSS.** A declaration that never applies looks identical to one that
  works, and nothing in the toolchain flags it — not `tsc`, not the style policy, not a test that
  greps stylesheet text. Four live instances were found in one pass: `:host(:has(> lr-x))`
  (`:has()` is invalid inside `:host()` — the whole rule drops); `[part='x']:empty` (Chromium's
  `:empty` doesn't ignore the whitespace-only text nodes Lit leaves in a part, so it never
  matches — load-bearing there, since the element it would have hidden is a focus target); a
  `--lr-x-height: auto` sentinel declared on `:host` (a *declared* value, `auto` included, wins
  over the `var()` fallback arm, deadening the fallback and everything chained behind it); and a
  consumer regression test asserting `source.toContain('--lr-token: …')` that passed the whole
  time the token was being shadowed at a nested host. The only reliable check is to **assert the
  rendered result** — `getComputedStyle` on the real element in the real state, or a hit test —
  never the stylesheet text. When adding a rule with an unusual selector, prove it matches:
  `CSS.supports('selector(...)')` for exotic selectors, plus a deliberately-perturbed value to
  confirm the assertion actually bites. Two cases now have a real gate,
  `scripts/check-part-reachability.mjs` (in contract-policy): (a) a bare `[part='x']` selector
  for a part the component renders through `<lr-virtual-list>`'s `renderItem` — it lands in
  *that* element's shadow root where the selector can never reach; and (b) an invalid `::part()`
  compound — `::part(x)` is a pseudo-element, so per Selectors L4 only *pseudo-classes* may
  follow it: `::part(x):hover`, `::part(x)::selection`, and the part-list form `::part(a b)` are
  fine, while `::part(x)[attr]`, `::part(x).cls`, and `::part(x) .descendant` all parse and
  silently never match. Encode state in the part name instead (`part="page page-current"`),
  noting the specificity flip that comes with it — `[part='x'][aria-current]` out-specified
  `[part='x']:hover`, but `::part(x-current)` and `::part(x):hover` are equal, so the state arm
  usually needs its own `:hover` companion. A component that legitimately renders the same parts
  into both its own shadow root and the virtual list's needs both selectors and is exempt
  automatically; anything else genuinely exceptional takes a
  `policy-allow(cross-root-part): reason` comment, the same marker `check-source-policy.mjs`
  uses.
- **Granular, tree-shakeable exports.** Each component's `.ts` file is a side-effect-free class
  export; a matching side-effectful entry point registers the tag. `src/lyra.ts` is the barrel —
  side-effect imports for every component (registers all tags) plus named re-exports of
  classes/types/helpers. `package.json#exports` maps `.`, `./components/*`, `./internal/*`;
  `sideEffects` is an explicit enumerated array, not globs — every registration module listed
  individually in both compiled (`./dist/components/<name>/<name>.js`) and source
  (`./src/components/<name>/<name>.ts`) forms, alongside the barrel (`./dist/lyra.js` +
  `./src/lyra.ts`) and `./dist/theme.css`. A new component therefore needs BOTH entries added by
  hand; `scripts/check-side-effects.mjs` (in contract-policy) fails when either form is missing
  or duplicated. The `.ts` entries matter because Storybook's production build
  (`pnpm docs:build`, i.e. the live docs site) imports `src/*.ts` directly rather than `dist/`;
  without them Rollup treats those source files as side-effect-free and tree-shakes away every
  side-effect-only component import, so no `<lr-*>` element ever registers on the deployed site.
  Keep plain class modules free of top-level side effects or tree-shaking breaks for every
  consumer.
- **Form-associated controls** use the `FormAssociated` mixin (`src/internal/form-associated.ts`,
  built on `ElementInternals`) where the value fits a plain string (`lr-date-input`); it calls
  `internals.setValidity()` so `required` participates in native constraint validation
  (`checkValidity()`/`reportValidity()`/`:invalid`). Components whose value isn't a single string
  (e.g. `lr-combobox`'s multi-select array) attach `ElementInternals` directly instead, but must
  still call `setValidity()` themselves — see `combobox.ts`'s `updateValidity()` for the pattern.
- **JSDoc header** on the component class (`@customElement lr-x`, `@slot`, `@csspart` tags — see
  any existing component, e.g. `components/empty/empty.ts`) feeds the generated manifest and the
  consumer-facing docs. The block must sit **directly above** `export class Lyra*` — if a
  `*EventMap` interface or a `FormAssociated`-style `*Base` class intervenes, `cem`'s analyzer
  silently misattributes or drops the whole block, emptying that component's manifest entry
  (`cssParts`, `events`, description all go missing) with no build error. This has already hit 42
  of 86 classes library-wide, including a repeat in newly-shipped components — check the
  generated `custom-elements.json` entry actually has content after adding a component; don't
  just trust that `tsc`/`pnpm manifest` stayed green.
- **Lean/full split.** A component with a meaningfully size-costly full feature set may ship as a
  pair: a bundle-size-lean default (`x.class.ts`) and a full variant (`x-core.class.ts`), e.g.
  `code-block`/`code-block-core` and `markdown`/`markdown-core`. Private render/helper logic
  shared between the two lives in a dedicated `x-shared.ts` module — never duplicated verbatim
  across both class files, which silently reintroduces exactly the maintenance burden the split
  was meant to avoid.
- **Never reference internal process in code comments or shipped docs.** Comments, JSDoc, and the
  `llms.txt`/`llms/` reference must not cite internal audits or design reviews,
  plan/spec/ledger docs, internal task/tier/project codenames, section-mark (`§`) references,
  audit severity ratings (`High`/`Medium`/`Low`), dated review findings, client/project names,
  local filesystem paths, or adoption/"battle-tested" status. This source ships verbatim in the
  public npm tarball (`dist/`, `custom-elements.json`, `llms.txt`, `llms-full.txt`, `llms/` all
  carry these comments) — anything written here is published. Keep the *technical* rationale
  ("previously X was broken, so we do Y") and drop the provenance — a code comment explains the
  code, not who reviewed it. Local-only planning/agent-tooling directories must never be
  referenced by path — by name or otherwise — from any tracked file, and must stay untracked via
  local git exclude config rather than the committed `.gitignore` (which would itself name them).
- License: MIT. TypeScript strict.
