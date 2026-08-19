# Coding conventions — lyra-ui agent reference

> Detail behind the "Coding conventions" digest in [AGENTS.md](../../AGENTS.md). Every component
> follows these — deviating needs a strong reason.

- **Extend `LyraElement`** (`src/internal/lyra-element.ts`), not `LitElement` directly. It
  supplies the token CSS layer (`static styles = [tokens]`) and `this.emit()`.
- **Never hard-code `"lr-"`.** Tag names go through `tag(name)`; register via
  `defineElement(name, ctor)` (`src/internal/prefix.ts`, idempotent — safe to import twice). The
  prefix is a single constant (`LYRA_PREFIX`) so a rename stays cheap.
- **Design tokens only.** Every color/space/font/radius value in component styles references a
  centralized `--lr-*` custom property. Themeable base tokens read a `--lr-theme-*` application
  input and provide a built-in fallback; aliases, computed tokens, the colour ramp, environment
  values, and fixed contract constants may instead resolve through another internal token or a
  value that is not a theme decision. The brand accent illustrates the chain:
  `--lr-color-brand` aliases `--lr-color-brand-fill-loud`, whose themeable semantic token reads
  `--lr-theme-color-brand-fill-loud` and falls back to the mode-specific ramp (`#035ec6` in light
  mode, `#5b9eff` in dark mode today). Consumers retheme through the supported `--lr-theme-*`
  inputs at any ancestor; consult the generated `packages/lyra-ui/llms/tokens.md` catalog because
  aliases, derived tokens, and fixed values have no direct theme hook. No raw hex/px design values
  in component styles, except where an algorithm genuinely requires a literal (e.g. gauge
  sweep-angle math) — and expose even that as a retheme-able `--lr-*` property when it's
  data-driven (e.g. a color-ramp endpoint).
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
- **Closed string sets are literal union types, never a real TypeScript `enum`.** A prop backed by
  a fixed set of strings (`variant`, `placement`, `size`, `tone`, `status`, ...) is typed as a
  colocated exported union — e.g. `export type ButtonVariant = 'neutral' | 'brand' | 'success' |
  'warning' | 'danger'` (`button.class.ts`), assigned directly to the `@property`. Two concrete
  reasons, not style preference: a string `enum` is nominal, so `el.variant = 'brand'` — the
  normal way to set a property in TS, as opposed to writing the HTML attribute — fails to
  typecheck without `ButtonVariant.Brand`, defeating the point of an attribute-reflected API; and
  an `enum` compiles to a runtime object even when nothing imports it by name, fighting the
  tree-shaking/bundle-budget discipline below. Grep `@property\([^)]*\)\s+[a-zA-Z]+\??\s*:\s*'` for
  an inline union that isn't a named-type reference — extract to a named type once the same
  literal set reappears elsewhere in the component (a switch/lookup object, `includes()` guard, a
  test) rather than leaving two hand-kept copies to drift. Use `as const` arrays/objects (56
  already do) when the set needs runtime iteration; never `Object.values(SomeEnum)`.
- **Single-quoted string literals, enforced by `check:source-policy`'s `double-quoted-literal`
  rule.** A double-quoted literal outside a template literal, whose content has no single quote to
  escape, fails `pnpm lint`. This is not just house style: a component's `.class.ts` string-literal
  and default-value types are printed verbatim into `custom-elements.json`, and
  `check:pinned-upstream-manifests` compares that printed text byte-for-byte against the pinned
  upstream Web Awesome/Shoelace manifest. A file mechanically reformatted to double quotes by a
  different tool's defaults is therefore not a cosmetic regression — every mapped member whose type
  or default changed quote style stops matching upstream's single-quoted text, silently
  reclassifying an otherwise-identical mapping from `rewritten` to the strict-blocking `unsupported`
  (a real incident: one pass of this reformatting reached ~300 files across the tree and
  reclassified `wa-button`/`wa-rating`/`wa-select`/`wa-input`/`wa-textarea`/`sl-input`/
  `sl-textarea`/`wa-date-input` before the rule existed). The rule's tokenizer mirrors
  `check-source-policy.mjs`'s own comment/string/template state machine, so it resumes scanning
  inside a Lit `${...}` interpolation — a `part=${cond ? "a" : "b"}` binding is still checked —
  rather than treating everything inside `` html`...` `` as opaque. A double-quoted literal whose
  content contains an apostrophe is correctly left alone (converting it would require adding an
  escape, which is a net style regression, not an improvement).
  A related pitfall: reflowing a public member's type across multiple lines (e.g. breaking
  `Extract<LyraAppearance, 'filled' | 'outlined'>` onto three lines) changes its *printed* text —
  the manifest text-extraction step folds the intervening newlines into literal spaces
  (`Extract< LyraAppearance, 'filled' | 'outlined' >`), which desyncs the same
  `check:pinned-upstream-manifests` comparison (and any recorded `normalizations` entry that
  expected the single-line spelling) even though nothing semantic changed.
- **Icon-sized hit targets.** Any `<button>`/`role="button"`/`tabindex="0"` element carrying a
  `part=` resolves its clickable box to at least `--lr-icon-button-size` via
  `min-inline-size`/`min-block-size` — a floor, not a fixed size, so larger slotted content still
  grows it. `pnpm run check:hit-area` checks this and honours a `hit-area-exempt` comment.
- **`rel` is settable; the `target`-derived guard is not removable.** A property that can set a real
  anchor's `target` must guarantee that setting `target` alone still produces
  `noopener noreferrer` — a consumer who sets only `target="_blank"` and gets an anchor with no
  `rel` has a live reverse-tabnabbing vector, not a style nit. The guarantee is implemented by
  *merging* rather than by refusing author input: take the author's tokens, always drop `opener`
  (the one token that re-opens the vector), and force-add `noopener` + `noreferrer` whenever
  `target` is set. `button.class.ts`'s and `breadcrumb-item.class.ts`'s `resolvedRel` getters are
  the reference implementation.

  This replaces the earlier, stricter rule ("never expose `rel` independently of `target`", still
  the shape `app-rail-item.class.ts` uses). That rule was over-broad in both directions: it refused
  a same-tab link, which opens no new browsing context and needs no guard at all, and it silently
  discarded every `nofollow`/`me`/`license`/`external` written by a consumer migrating from
  `wa-*`/`sl-*` — where `rel` is a documented settable property. Because `migrate-wa.mjs` warns at
  tag granularity rather than member granularity, that divergence also refused **every**
  `<wa-button>`/`<sl-button>` in a migrating app, including ones with no `href` at all.
- **Resolve CSS colors before assigning `ctx.fillStyle`/`strokeStyle`.** Canvas 2D's setter is a
  spec'd silent no-op on an unparseable string: it keeps the previous value, usually black, with
  no error. Any canvas path deriving a color from a `--lr-*` property, a consumer callback, or a
  `color-mix()`/`var()` expression round-trips it through `getComputedStyle` into a concrete
  color first — `heatmap.class.ts`'s `resolveRgb()` and `graph.class.ts`'s
  `resolveCssColorValue()` are the patterns. `chart.class.ts`'s `themeColors()` is a third
  instance for Chart.js specifically: Chart.js also renders to `<canvas>` and cannot read a
  `var()` color option at all — it silently falls back to its own default (e.g.
  `rgba(0,0,0,0.1)`), invisible in dark mode — so every `--lr-chart-*` token needs the same
  `getComputedStyle` resolution first. Contrast `lr-lite-chart`, which renders to SVG/CSS and
  *can* hand the DOM a raw `var(--lr-chart-color-N)` string resolved at paint time — don't copy
  that approach into a canvas-based component. A series with no explicit color should default to
  the categorical `--lr-color-chart-1..8` ramp keyed by dataset index.
- **Resolve token units live; never hardcode `rem = 16px`.** A helper that reads a `--lr-*` size
  token via `getComputedStyle(...).getPropertyValue(...)` for layout or canvas math resolves the
  live pixel value for whatever unit the token carries —
  `getComputedStyle(document.documentElement).fontSize` for `rem`,
  `getComputedStyle(this).fontSize` for `em`. A hardcoded `* 16` gives systematically wrong
  geometry under a non-16px root font size, a common accessibility setting. `table.class.ts`'s
  `minimumResizeWidth()` is the reference; `mind-map.class.ts`'s `ringGapPx()` the
  counter-example. Related but distinct: `rem` means something different in `@media` vs.
  `@container` at the CSS level — `@media` resolves `rem` against the browser's *initial* font
  size and ignores `html { font-size }` entirely, while `@container` follows the root's
  *computed* size. Any feature offering a "viewport" vs. "container" breakpoint basis must pick
  its `rem`-resolution path to match — this shipped backwards in three places before being
  corrected before release.
- **A `var()` fallback chain is not a live formula across a shadow boundary.** CSS inheritance
  passes a descendant's `:host`-level custom property the ancestor's already-*resolved* value,
  not a formula it re-evaluates per instance — so a per-element override meant to win only when
  unset (e.g. "use `backdropInset` if set, else `fullscreenInset`") can be invisible through a
  pure `var(--a, var(--b))` chain. Resolve the precedence in JS instead (`this.a || this.b`) and
  verify with a real browser assertion, not by reading the CSS.
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
- **A backtick inside a `css` / `html` tagged template terminates the literal — including inside a
  comment.** These files are one enormous template literal each: a `*.styles.ts` typically opens
  ``css` `` on line 4 and closes it 500 lines later, and the explanatory comments that make them
  readable live *inside* it. A CSS block comment or an HTML `<!-- … -->` comment is only a comment to
  the CSS/HTML parser; to the JavaScript parser it is ordinary template text, so a stray backtick
  in prose ("use the `css` helper", a quoted token name, a Markdown-style code span) ends the
  template right there. Everything after it is parsed as code, and the failure surfaces as a
  `TS1005: ',' expected` pointing at some innocent line dozens of lines further down — usually at
  whatever punctuation in the following prose first fails to parse — so the reported location is
  never the real one. `${` in a comment is the same trap with a different shape: it opens an
  interpolation hole and the comment text after it becomes an expression. This broke the tree twice
  in one day. Write token and helper names in comments unquoted, or with single quotes; if a
  backtick is genuinely unavoidable, escape it with a preceding backslash. When a parse error
  appears in a `*.styles.ts`, grep the file for backticks first: a healthy one has exactly two
  hits, the opening and closing delimiter.
- **`*/` inside comment prose closes the comment early**, reinterpreting the rest of the
  sentence as CSS. Found while compressing style comments: `--lr-button-padding-*/--lr-button-font-size`
  in a sentence is enough. It is quieter than the backtick and `${` traps because it does NOT
  change the file's backtick count, so the usual "confirm 2 backticks" check passes. Only a
  rendered result or a parsed-CSS comparison against the pre-edit file catches it.
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
  confirm the assertion actually bites. Three cases now have a real gate,
  `scripts/check-part-reachability.mjs` (in contract-policy): (a) a bare `[part='x']` selector
  for a part the component renders through `<lr-virtual-list>`'s `renderItem` — it lands in
  *that* element's shadow root where the selector can never reach; (b) a public-part-bearing
  component recursively rendering its own tag without `exportparts` — every child introduces a
  shadow boundary that stops an outer `::part()` selector; and (c) an invalid `::part()` compound
  — `::part(x)` is a pseudo-element, so per Selectors L4 only *pseudo-classes* may
  follow it: `::part(x):hover`, `::part(x)::selection`, and the part-list form `::part(a b)` are
  fine, while `::part(x)[attr]`, `::part(x).cls`, and `::part(x) .descendant` all parse and
  silently never match. Encode state in the part name instead (`part="page page-current"`),
  noting the specificity flip that comes with it — `[part='x'][aria-current]` out-specified
  `[part='x']:hover`, but `::part(x-current)` and `::part(x):hover` are equal, so the state arm
  usually needs its own `:hover` companion. A component that legitimately renders the same parts
  into both its own shadow root and the virtual list's needs both selectors and is exempt
  automatically. A genuinely exceptional virtual-list or recursive boundary takes a
  `policy-allow(cross-root-part): reason` or `policy-allow(recursive-part-forwarding): reason`
  comment, respectively; these use the same marker shape as `check-source-policy.mjs`.
- **Granular, tree-shakeable exports.** Each component's `.class.ts` file is a side-effect-free class
  export; a matching side-effectful entry point registers the tag. `src/lyra.ts` is the pure package
  root, containing only curated named re-exports of classes/types/helpers. `src/all.ts` is the
  explicit compatibility registration entry; its inventory-generated import block registers every
  root-included tag. Never put a hand-authored export inside that generated block or generate the
  `lyra.ts` export surface: the latter is reviewed and semver-covered by hand. Stable generated
  `src/components/lr-*.ts` aliases provide family-independent per-tag registration paths.
  `package.json#exports` maps `.`, explicit inventory-derived component/AI routes, and explicit
  curated utility/helper routes — never broad `./components/*`, `./ai/*`, or `./utilities/*`
  wildcards, and never `./internal/*`. Internal paths were removed on purpose: only the curated
  `src/utilities/` re-exports are semver-covered, and an `internal/` specifier fails to resolve outright
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`) rather than degrading, in a consumer's code and in this repo's
  own check fixtures alike. A helper that needs to be reachable gets a `src/utilities/` re-export,
  not just its `src/internal/` home.
  `sideEffects` is an explicit enumerated array, not globs — every registration module is listed
  individually in both compiled (`./dist/components/<family>/<name>/<name>.js`) and source
  (`./src/components/<family>/<name>/<name>.ts`) forms, alongside the tag aliases, `all.js`, and
  CSS/locale/companion registration side effects. The pure `lyra.js` root is not a side effect.
  Do not edit that array or the root-registration allowlist by hand. After adding, moving, or
  removing a component, refresh the inventory and run `pnpm registrations`; this regenerates the
  `all.ts` import block, aliases, allowlist, side-effect forms, and explicit package-export map
  together. `check:registrations`, `check:package-exports`,
  `check-side-effects`, their
  deterministic self-tests, and CI's regenerate-and-diff step fail on stale, duplicate, or missing
  entries. The `.ts` entries matter because Storybook's production build
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
  any existing component, e.g. `src/components/overlays/empty/empty.class.ts`) feeds the generated
  manifest and the consumer-facing docs. The block must sit **directly above** `export class
  Lyra*` — if a
  `*EventMap` interface or a `FormAssociated`-style `*Base` class intervenes, `cem`'s analyzer
  silently misattributes or drops the whole block, emptying that component's manifest entry
  (`cssParts`, `events`, description all go missing) with no build error. This has already hit 42
  of 86 classes library-wide, including a repeat in newly-shipped components — check the
  generated `custom-elements.json` entry actually has content after adding a component; don't
  just trust that `tsc`/`pnpm manifest` stayed green. A related, separate trap: **`@internal` on
  a class's own JSDoc, alongside `@customElement`, also silently empties its manifest
  declaration** — not a missing field, the whole entry vanishes, again with no build error. This
  is specific to co-presence on the *class* doc; `@internal` on individual members is fine. Don't
  tag a still-registered (even if undocumented) component's class `@internal` for this reason.
  Separately, `check-manifest.mjs`'s dynamic-`part=` detection is regex-based, not real
  type-flow analysis, and has known blind spots: `exportparts="inner:outer"` forwarding, a local
  `const part = <ternary>` variable or typed `part: 'a' | 'b'` parameter applied via
  `part=${part}`/`setAttribute`, and a static `part="prefix ...${identifier}"` with exactly one
  interpolation. All three are handled today, but a "documented CSS part is not rendered
  statically" false positive on a new legitimate pattern means extending the checker, not
  assuming the component is wrong.
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
