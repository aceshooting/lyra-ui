# RFC 0002: Declare design tokens once per document

- **Status:** Accepted (deferred to 28.0.0 after the 27 perf gate)
- **Decision:** Accepted by the maintainer on 2026-09-27, with the 22.0 switch still conditional on
  the performance release gate; the unresolved questions not marked closed stay open, and closed
  question 3's removal of bare `.light`/`.dark` follows the fixed stylesheet's removal release
  (no earlier than v24 when deprecated in v22), under [RFC 0003](0003-lyra-v21-migration-profile.md) question 11.
- **Authors:** Lyra UI maintainers
- **Created:** 2026-09-27
- **Tracking issue:** None yet; [roadmap](../roadmap.md) v22, "Architecture and packaging", item 30
- **Supersedes / superseded by:** None

## Summary

Every Lyra component re-declares the whole shared token layer on its own `:host`: 293 unconditional
custom-property declarations per element (the colour ramp, the semantic colour grid, and the base
aliases for spacing, type, radius, elevation, motion and focus). This RFC moves 290 of them to one
constructed stylesheet per document. The first connected Lyra element adopts it into its document,
and into an application's shadow root where a scope inside that root needs it. The sheet declares
the layer on `:root` and re-derives it only at explicit **theme scopes**: `.lr-light`, `.lr-dark`,
`[data-lr-theme]`, the design-token fixture scopes, a new mode-neutral `[data-lr-theme-scope]`
marker, and RFC 0001's axis attributes. Mode reaches every scope through two inherited private
switches, shared with RFC 0001, so a scope that sets no mode keeps its ancestor's mode, with or
without `theme.css`. The forced-colours and reduced-motion arms also stay on every host, where no
application declaration outside the host can defeat them; they cost nothing while the preference is
off.

A reproducible spike compares the package as built (A) with a prototype of exactly this design (E)
in Chromium, Firefox and WebKit (Appendix A; harness and full tables in
[`0002-evidence/`](0002-evidence/)):

- **Rendering.** 30 theming forms in 15 page modes and 3 engines. With `theme.css`, every scoped
  form has identical styles; the forms that differ are exactly the breaking changes below. Without
  `theme.css`, E also follows the nearest mode scope in every engine; v21 follows an ancestor mode
  scope only in Chromium, and even there not a light island inside a dark region.
- **Memory and render time.** Firefox uses 40–46 % less memory at 1,000–3,000 elements in the
  six-type mix, and 45 % less with rows streamed one at a time; it renders up to 29 % faster. With
  one batched insert and no style reads the memory gain is 5 %, so it depends on how a page batches
  its style work. Chromium and WebKit memory stay within 3 % without scopes.
- **Re-theming.** Root-level accent changes are 40–69 % faster in WebKit and spacing changes 28–46 %
  faster, in every scenario without scopes. Firefox gains up to 30 % (more with scopes); Chromium
  moves within ±5 % on the quietest run.
- **Costs.** Scopes cost something, and not all of it is explained. With 50 nested scopes the first
  draft regressed in Chromium (accent +15 %, deferred flush +26 %, initial render +18 %) and WebKit
  (mode switch +31 %); E did not regress there, but WebKit's mode switch rose again. A scope on
  every row, and application shadow roots, show single-metric regressions of 4–12 % (Chromium
  spacing, WebKit render and mode switch, Firefox mode switch). Adopting the layer into every
  application root costs more, so the proposal adopts only where a scope needs it. The first
  adoption on a page with 20,000 application rows costs 37–166 ms once. Measured on a shared
  machine, these fail the performance goal until an idle-machine run clears them.
- **Server rendering.** Each server-rendered element carries 34 KB less `<style>` text (one
  `lr-button`: 52,767 → 18,629 bytes of HTML). A page of 100 buttons gzips to 17 KB, not 633 KB.

The main breaking change: a `--lr-theme-*` input that the layer consumes, set on an element that is
not a theme scope, no longer re-derives the components below it; one attribute restores it. The
contract lists every behaviour change. **Recommendation:** accept for v22, with the 22.0 switch
conditional on the performance release gate; ship the compatible preparations in 21.x and migrate
with the `--origin=lyra-v21` profile.

## Motivation

### How tokens reach components today

`LyraElement.styles` is `[palette, tokens, topLayerReset]`
(`packages/lyra-ui/src/internal/lyra-element.ts`). Lit turns each `CSSResult` into one constructed
`CSSStyleSheet` shared by every shadow root that adopts it, so each sheet is parsed once per page.
The resolution is not shared: both sheets declare their tokens on `:host`, so every element declares
its own copy of every token, and each `var(--lr-theme-x, fallback)` is substituted on that element.
Measured on the built package with `lr-button`, `lr-input`, `lr-card`, `lr-badge`, `lr-icon` and
`lr-switch`, with the same counts in all three engines:

| Per element | Today (A) | Proposed (E) |
|---|---:|---:|
| Custom-property declarations in the two shared sheets | 529 | 41 |
| …unconditional | 293 | 3 (the host-local properties) |
| …only under `:dir(rtl)` or a media condition that is off by default | 236 (180 of them the three dark routes) | 38 (forced colours 25, reduced motion 10, coarse pointer 1, RTL 2) |
| Custom properties the host declares rather than inherits | 289–339 | 3–53 (3 plus component-local ones) |
| Custom properties on `:root`, with `theme.css` | 273 | 561 (560 in Firefox) |
| Text of the two shared sheets | 36,536 bytes | 2,398 bytes, plus one 24,072-byte document sheet |

Adopted sheets per shadow root do not change (4–6, all shared). Firefox and WebKit expose 447 rather
than 529 declarations in the CSSOM because they drop the `:host-context()` rules.

The per-host design exists for one reason: it makes a `--lr-theme-*` input set on *any* wrapper
re-theme every component below it (`llms/shared.md`, "Where an override actually reaches"). It has
five costs:

1. **Resolution and memory scale with element count.** Each host resolves about 300 declarations.
   How much that costs depends on how well an engine shares computed custom properties between
   hosts.
2. **Server-rendered pages repeat the layer per element.** Lit's server renderer writes static
   styles into every declarative shadow root: about 34 KB of shared layer per element.
3. **An application's own elements cannot read the layer** without opting into `tokens-root.css`.
4. **Output overrides on ancestors are lost silently** at the first Lyra host below them.
5. **The dark palette has three parallel routes, and the ancestor route is Chromium-only.** Without
   `theme.css`, a `.lr-dark` ancestor darkens components only in Chromium, and there it also darkens
   a `.lr-light` island inside it (`docs/agents/i18n-rtl-theming.md`).

### Measured effect

The harness renders N = 1,000 and 3,000 components (200 in Run 1) and measures initial render,
root-level re-theming and memory, alternating variant order between runs (method in Appendix A).
The main mix is `lr-button`, `lr-input`, `lr-card`, `lr-badge`, `lr-icon` and `lr-switch`. The
quietest run compared A with the first prototype, B, which declares the same layer and differs from
E only in how the root resolves mode and in rules that are inactive on these pages (the
media-conditioned host arms, the application-root check). At N = 3,000, 7 runs per cell, load
average 3–5:

| Engine | Insert → first full style and layout | Style work | Accent input change | Spacing input change | Mode switch | Memory growth |
|---|---:|---:|---:|---:|---:|---:|
| Chromium 153 | 2,993 → 2,878 ms (−4 %) | recalc 911 → 806 ms (−12 %) | 135 → 129 ms (−5 %) | 107 → 107 ms (0 %) | 141 → 133 ms (−5 %) | 120 → 118 MB (−2 %) |
| Firefox 155 | 3,468 → 2,682 ms (−23 %) | deferred flush 254 → 216 ms (−15 %) | 101 → 85 ms (−16 %) | 99 → 88 ms (−11 %) | 103 → 104 ms (+2 %) | 323 → 175 MB (−46 %) |
| WebKit 26.6 | 3,414 → 3,604 ms (+6 %, overlapping spread) | deferred flush 8.9 → 9.6 ms | 626 → 339 ms (−46 %) | 740 → 448 ms (−39 %) | 293 → 299 ms (+2 %) | 171 → 170 MB (0 %) |

At N = 1,000 Firefox renders 29 % faster, uses 41 % less memory and re-themes 19–30 % faster in all
three kinds; WebKit re-themes 39–46 % faster for accent and spacing; Chromium re-themes within ±3 %,
and spends 10 % less time recalculating style (21 % at N = 200). Run 7 repeats the mix with E on a
busier machine (load 8–14): Firefox memory −40 % and −46 %, WebKit accent −46 % and −43 %, spacing
−40 % and −28 %, Chromium and WebKit memory within 2 %, and every timing within spread or faster.

### Where the cost shows up

Two scenarios drop `lr-card`, whose first update reads computed style, to separate the effects (A
against B, and against D for the streamed rows; N = 3,000):

| Scenario | Chromium | Firefox | WebKit |
|---|---:|---:|---:|
| One batched insert, no style reads: initial render | −1 % | +1 % | −1 % |
| One batched insert, no style reads: memory growth | −3 % | −5 % | 0 % |
| Rows streamed one at a time, style flushed after each: initial render | −14 % | −20 % | −3 % |
| Rows streamed: style recalc time (Chromium) or memory growth | recalc −14 % | memory −45 % | memory 0 % |
| Accent input change on the root, either scenario | −2 % to −4 % | −9 % to −13 % | −45 % |

In one batched style pass, engines share computed tokens between sibling hosts that match the same
rules, which hides most of the per-host cost. Styled a few at a time, that sharing is lost, and
Firefox allocates the whole resolved layer per host. The Firefox memory gain is therefore a property
of how a page batches its style work: 41–46 % for the six-type mix (where `lr-card` forces a style
recalculation per instance) and for streamed rows, 5 % for one batched insert with no style reads.
The streamed scenario forces a flush after every row, the least favourable batching for A; how real
pages batch was not measured. WebKit's re-theming gain holds in every scenario. Moving only the
literal-valued properties (variant C, 56 declarations) has no measurable effect in any engine: the
cost comes from declarations that reference other properties.

Initial render is mostly script (Lit rendering and component setup), and `lr-card` forces three
style recalculations and one layout per instance; the layer does not change that. A light/dark
switch re-declares 111 inputs on the root and gains least: within ±8 % at 3,000 elements without
scopes.

### With scopes and application shadow roots

Every scope re-derives the layer, and every tree scope that adopts it matches its rules, so these
configurations cost more than a page without scopes. Changes against A at N = 1,000 and 3,000, 5
runs per cell; **bold** marks a regression whose interquartile ranges separate from A's:

| Configuration (run; load average) | Chromium | Firefox | WebKit |
|---|---|---|---|
| 50 nested scopes, first draft D (6; 9–20) | accent **+15 %** and spacing +29 % at 1,000; deferred flush **+26 %** at 3,000 | render −22 to −29 %; memory −32 to −35 %; re-theme −21 to −38 % | mode switch **+31 %** at 1,000; accent −48 to −56 %; spacing −21 to −39 % |
| The same, a second Chromium run at 1,000 (6b; about 23) | initial render **+18 %**; deferred flush **+26 %**; accent −17 %; spacing −21 % | | |
| 50 nested scopes, E (8; 8–32) | every metric within spread (−30 % to +8 %) | render −30 to −34 %; memory −33 to −36 %; re-theme −20 to −42 % | mode switch +9 % and +29 %, render +22 % at 3,000, all within spread; accent −24 to −48 % |
| A scope on every row, E (9; 32–39) | spacing **+6 %** at 1,000; render +77 % and recalc +59 % at 3,000 within wide spread | memory −40 to −46 % | render **+7 %** at 1,000; accent −42 to −54 %; spacing −33 to −42 % |
| Every row in an application shadow root, layer adopted into every root (10; 14–39) | style recalc **+23 %** and **+10 %**; render **+13 %** at 1,000; memory **+7 %** at 3,000 | render −14 to −27 %; memory −36 to −38 % | render **+21 %** and mode switch **+25 %** at 1,000; accent −24 to −63 % |
| The same, each application host also a scope (11; 6–14) | style recalc **+53 %** at 1,000; memory **+12 %** at 3,000 | render −19 %; memory −29 to −31 % | render **+16 %** and mode switch **+4 %** at 3,000; accent −29 to −43 % |
| The same, adopted only where a scope needs it: the proposal (12; 5–13) | no regression; style recalc −10 % and deferred flush −21 % at 3,000 | memory −42 to −46 %; mode switch **+12 %** at 3,000 | render **+11 %** and mode switch **+4 %** at 3,000; accent −45 %; spacing −34 to −36 % |

What this shows:

- The first draft's separated regressions with 50 nested scopes did not recur with E, but WebKit's
  mode switch rose in both runs, and Chromium's initial render rose in both first-draft runs.
- WebKit's mode switch is the least consistent metric: from −25 % to +31 % across runs, separated
  upward in five cells (+4 % to +31 %, Runs 3, 6, 10, 11 and 12) and downward in one.
- A scope on every row costs Chromium and WebKit a little, so the migration report warns before it
  adds markers inside repeated templates.
- Adoption into every application root, and `:host` as a scope, cost Chromium and WebKit clearly
  (Runs 10 and 11); on-demand adoption removes Chromium's cost (Run 12) and is what this RFC
  proposes.
- Firefox's memory and WebKit's accent changes gain in every configuration; WebKit's spacing changes
  in every configuration but one cell (+7 % within spread, Run 10).

These runs shared the machine with other work, several at very high load, so they bound the question
rather than settle it. The regressions that remain fail this RFC's performance goal until an
idle-machine run clears them. The release gate decides, and per-family scopes (open question 11) are
the lever if it does not.

### Parity

`web/parity-e.html` renders 30 forms, each as the six benchmark components plus `lr-graph-legend`,
which adopts the specialist palettes: the scoped and unscoped theming forms, nested mode-neutral
scopes, design-token fixture scopes, nested `.dark` and `.light` regions, `dir="rtl"`, three
application shadow roots, an application component that sets inputs on its own `:host` (marked and
unmarked), and a consumer `LyraElement` subclass. It compares resolved token values on every host,
18 computed properties on every host and shadow descendant, and a pixel diff per form, after every
running transition has finished. 15 page modes × 3 engines:

| Page modes | Forms with identical styles, A vs E (Chromium · Firefox · WebKit) | Forms that differ |
|---|---|---|
| With `theme.css`: light, dark root, OS dark, reduced motion, reduced motion with unlayered application motion overrides; with the fixed shadcn look, light and dark root | 25 · 25 · 25 | the five breaking forms (changes 1–3) |
| With `theme.css`: forced colours, forced colours with dark root, forced colours with unlayered application colour overrides | 25 · 25 · 25 | four breaking forms (system colours hide change 2) and one token value (below) |
| Without `theme.css`: light, reduced motion | 24 · 16 · 16 | the breaking forms, plus mode fixes (change 5) |
| Without `theme.css`: dark root attribute | 23 · 6 · 6 | as above; v21 renders nearly every form light in Firefox and WebKit |
| Without `theme.css`: OS dark, forced colours with OS dark | 23–24 · 23–24 · 23–24 | as above; v21 renders `.lr-light` scopes dark |

`parity-modes.mjs` reads the mode each form renders in. Without `theme.css`, E renders the nearest
mode scope's mode in every engine, and every difference beyond changes 1–3 is a form where A does
not. The one token-value difference: in forced colours, a Lyra host with `data-lr-theme="dark"`
resolves `--lr-focus-ring-color` to `#5b9eff` in v21, because `theme.css`'s focus-ring rule on
`[data-lr-theme='dark']` outranks the host's own forced-colours rule, and to `Highlight` in E; the
browser forces outline colours, so no pixel differs. In Chromium, four forms with identical styles
differ in 2–6 antialiased edge pixels by a few colour levels; A against itself shows none.

One limitation is unchanged: with `theme.css`, a mode scope *inside* an application shadow root
renders the document's mode in v21 and in E, because `theme.css`'s per-mode inputs apply only in the
document tree. RFC 0001's resolver closes that (its open question 12).

### Recommendation

Adopt the document layer for v22. The case rests on four grounds, none of which needs Chromium, the
engine that gains least:

1. Firefox memory and render time improve substantially wherever elements are styled incrementally,
   and WebKit's accent and spacing changes almost everywhere.
2. Server-rendered pages lose about 34 KB of repeated CSS per element.
3. An application's own elements get the resolved tokens without opting in.
4. Mode resolution becomes plain selectors that behave the same in every engine, and pages without
   `theme.css` stop depending on a Chromium-only route.

The breaking changes are narrow and detectable, and one attribute fixes the main one. The
regressions measured with scopes and application roots are not yet explained and fail this RFC's
performance goal, so the release gate (test plan) decides the 22.0 switch.

## Goals and non-goals

**Goals**

- Declare the shared token layer once per tree scope that needs it, not once per element.
- Keep scoped and nested theming working through explicit theme scopes, identically in Chromium,
  Firefox and WebKit.
- Zero configuration: with no Lyra stylesheet, every component renders correctly and every scope
  follows the nearest mode scope, including the operating-system preference.
- Stop inlining the shared layer into server-rendered declarative shadow roots, with a correct first
  paint before hydration.
- Render identically to v21 for every scoped form in light, dark, operating-system dark, forced
  colours and reduced motion, including when unlayered application CSS retunes published outputs.
- Performance: in every engine, no regression beyond measurement spread in initial render, the
  deferred flush, or any root-level re-theme, without scopes and in each scope configuration of the
  release gate. The prototype does not meet this yet (see *With scopes*).

**Non-goals**

- Moving component-local tokens: variant-following colour slots, size tokens, `--lr-<component>-*`
  hooks, and the specialist chart, graph and terminal palettes, which 13 component types adopt.
- Renaming or re-valuing any token or `--lr-theme-*` input.
- Making the whole `--lr-*` set public API. Every output becomes *visible* on `:root`; the stability
  promise stays with the names `tokens-root.css` documents.
- Removing `lr-card`'s first-update style reads, or other script-side render costs.
- Designing the style axes (RFC 0001). This RFC states what they must do to stay compatible.
- Registering tokens with `@property`.

## Proposed public contract

### The document token layer — breaking

The layer is every custom property that `internal/tokens/palette.styles.ts` and
`internal/tokens.styles.ts` declare today, except three host-local ones. It is generated from
`tokens/canonical-tokens.json`, like `tokens-root.css` already is, into one CSS text used two ways:
as a constructed stylesheet that `LyraElement` adopts (see *Composition and interaction*), and as
the static file `@aceshooting/lyra-ui/tokens-root.css`. Its rules sit in the `lr-theme` cascade
layer.

**Mode switches.** Only mode scopes set them; every other element inherits them.

```css
/* Generated. Private names; the same switches RFC 0001's resolver reads. */
@layer lr-theme {
  :root, .lr-light, [data-lr-theme='light'] { --_lr-dark-on: initial; --_lr-light-on: ; }
  @media (prefers-color-scheme: dark) {
    :root:not(.lr-light):not([data-lr-theme='light']) { --_lr-dark-on: ; --_lr-light-on: initial; }
  }
  .lr-dark:not([data-lr-theme='light']), [data-lr-theme='dark'] { --_lr-dark-on: ; --_lr-light-on: initial; }

  :root, .lr-light, .lr-dark, [data-lr-theme], [data-lr-theme-scope], /* …the scope list */ {
    --lr-space-m: var(--lr-theme-space-m, 0.75rem);                 /* 235 mode-independent outputs */
    --lr-color-surface:                                              /* 55 mode-dependent outputs */
      var(--_lr-dark-on, var(--lr-theme-color-surface-default, #fff))var(--_lr-light-on, var(--lr-theme-color-surface-default, #1a1a1a));
    /* … */
  }
  @media (forced-colors: active) { /* the scope list */ { --lr-color-surface: Canvas; /* 22 */ } }
  @media (prefers-reduced-motion: reduce) { /* the scope list */ { --lr-duration-fast: 0.001ms; /* 9 */ } }
}
```

A switch is empty (on) or `initial` (off), so exactly one branch of each pair survives (RFC 0001,
"How a switch works"). A mode-neutral scope re-derives against the switches it inherits, which is
what keeps a marked region inside `.lr-dark`, or under the operating-system preference, dark.
`light-dark()` would express the same pair for colours only, and needs Safari 17.5, above the v22
floor (Safari 17); style queries on custom properties are not available at the Firefox 125 floor.

**What stays on every host.** Written once in the shared shadow sheet, 41 declarations:

- `--lr-icon-button-size` (reads the subtree input `--lr-icon-button-size-scope` and applies the
  coarse-pointer floor per element) and the two logical safe-area aliases (mirrored under each
  element's own direction);
- the **preference arms**: under `forced-colors: active`, the 22 system-colour tokens plus the three
  outputs derived from them (`--lr-focus-ring`, `--lr-color-mix-partner`,
  `--lr-color-surface-overlay`); under `prefers-reduced-motion: reduce`, the 9 flattened motion
  tokens plus `--lr-transition-interactive`. A declaration on the host beats anything inherited, so
  an unlayered application `:root { --lr-transition-fast: 400ms ease }` cannot defeat reduced motion
  inside a component, as in v21. The generator computes the derived set from the dependency graph.

Every media-conditioned output arm, including future `prefers-contrast` and
`prefers-reduced-transparency` arms (the glass surface, roadmap item 4), is emitted both ways: at
the scopes, for application elements, and on the host. A gate enforces it.

**Specialist palettes** stay per host in `internal/specialist-tokens.styles.ts`, but read the mode
from the same switches instead of their own three dark routes, so they follow the nearest mode scope
too and lose their `:host-context()` rules.

### Theme scopes — new

A **theme scope** is an element that re-derives the layer from the inputs and switches it sees. The
generated list is closed:

| Selector | Source | Status |
|---|---|---|
| `:root` | the document | compatible |
| `.lr-light`, `.lr-dark`, `[data-lr-theme]` (any value) | existing mode scopes | compatible |
| `.lr-token-light`, `.lr-token-dark`, `[data-lr-design-token-mode]` | `design-tokens.css` fixture scopes | compatible |
| `.light`, `.dark` | nested regions of the deprecated fixed `themes/shadcn.css`; mode-neutral; removed with it no earlier than v24 | compatible in v22 and v23 |
| `[data-lr-theme-scope]` (presence; any value) | new mode-neutral marker | new |
| `[data-lr-mode]`, `[data-lr-look]`, `[data-lr-accent]`, `[data-lr-density]`, `[data-lr-surface]` | RFC 0001's axis boundaries | new with RFC 0001 |

`:host` is not a scope. An application component that sets inputs on its own `:host` marks its host
element, which is matched from the outer tree like any other element. A scope costs roughly what one
element costs today, so a page pays per scope, not per component. RFC 0001's `applyLyraStyleScope()`
writes the marker whenever it writes inline inputs, and adopts the layer into the element's root.

The marker follows HTML presence semantics: `data-lr-theme-scope="false"` still marks. React renders
`data-*={false}` as `"false"`, so the documentation uses `data-lr-theme-scope=""` or omits the
attribute, and the development build warns on the literal `"false"`.

### Which inputs need a scope

The layer consumes 215 `--lr-theme-*` inputs; only those need a scope. Component, specialist and
host-local declarations read 60 inputs on the host itself, and these keep working on any wrapper:
the chart, graph and terminal palettes (48), the form-control heights and radius (7), scrollbar
width and gutter, the progress-ring track width, the swatch-picker fill size and the icon-button
size. No input is read both ways, except that the forced-colours host arm re-reads the two inputs
behind `--lr-color-mix-partner` and `--lr-color-surface-overlay`. The split is generated into
`canonical-tokens.json`, published in `llms/tokens.md`, and bounds the diagnostic and the migration
report, so neither flags a host-read input (the repository's own stories set such inputs on plain
wrappers).

### Exports

| Surface | Status | Notes |
|---|---|---|
| `adoptLyraTokens(root: Document \| ShadowRoot): void` from `@aceshooting/lyra-ui/utilities/tokens.js`, re-exported from the package root | new | Idempotent. For a root whose scopes appear after its Lyra elements connected, a root with scopes but no Lyra element yet, or an iframe with application elements only. No-op during server rendering. |
| `@aceshooting/lyra-ui/tokens-root.css` | compatible | Same name and layer; grows from the curated subset to the whole layer. Its header stops saying "every name declared below is public API" and points to the documented stable subset. |
| `LyraElement.styles` | compatible | Still a valid `CSSResultGroup`; carries the host-local remainder. |
| `data-lr-theme-scope` attribute | new | On any element, including a Lyra host. |
| `findUnscopedThemeInputs(root?)` from `@aceshooting/lyra-ui/utilities/theme-scopes.js` | new (21.x) | Returns, without logging, elements whose inline style sets a layer-consumed input and that are not scopes. |
| Development diagnostic under the `development` export condition (roadmap item 37) | new (v22) | See *Compatibility and migration*. |

### Behaviour changes

| # | Behaviour | v21 | v22 | Status |
|---|---|---|---|---|
| 1 | Layer-consumed input on an element that is not a scope: a wrapper, a Lyra host's inline style, or an application component's own `:host` rule | Every Lyra component below re-derives | The components keep the nearest scope's values; add `data-lr-theme-scope` | breaking |
| 2 | `--lr-*` output set on an element that is not a scope, for the outputs derived from it (`--lr-focus-ring` from `--lr-focus-ring-color`, `--lr-color-brand` from `--lr-color-brand-fill-loud`, `--lr-color-border-subtle` from `--lr-color-border`; 64 outputs feed others) | Derived outputs on that host follow it | Derived outputs keep the scope's values; the output itself still applies. Marking the element restores the v21 result | breaking |
| 3 | `--lr-*` output set on an ancestor | Lost at the first Lyra host | Inherits until the next scope | breaking (widening) |
| 4 | Server-rendered declarative shadow roots | Carry the layer | Do not; link `tokens-root.css` | breaking for server-rendered pages |
| 5 | Mode without `theme.css` | OS preference and the host's own attribute everywhere; ancestor `.lr-dark`/`data-lr-theme="dark"` only in Chromium, where it also overrides a nearer `.lr-light`; `.lr-light` ignored under OS dark | Nearest mode scope, in every engine | visible fix |
| 6 | Application elements that read `--lr-*` outputs | Fallbacks, unless `tokens-root.css` is linked | Resolved values from the first Lyra connect; a lazily loaded route repaints them then | behaviour change |
| 7 | Layered application rules that declare `--lr-*` outputs on a scope element, on a page with no Lyra stylesheet | The application rule applies to application elements | The adopted sheet's layer statement comes last, so `lr-theme` outranks the application's layers there | behaviour change |
| 8 | An application replaces `adoptedStyleSheets` wholesale after its Lyra elements connected | No effect | The layer is gone from that root until the next Lyra element connects there | behaviour change |
| 9 | Two copies of Lyra | Each component uses its own copy | The later-adopted layer wins where values differ | behaviour change |
| 10 | Specialist palettes | Per host, three dark routes | Per host, mode from the switches; inputs still work on any wrapper | compatible, plus fix 5 |
| 11 | `theme.css`'s `--lr-focus-ring*` rule | Declared on the mode selectors, fallback `Highlight` | Removed; the layer owns the four names. `theme.css` sets `--lr-theme-color-focus` in both modes, so values do not change | compatible |
| 12 | `:host-context()` dark routes | Chromium only | Removed | compatible |
| 13 | A mode scope or marker added inside an application shadow root after its Lyra elements connected | Without `theme.css`, Chromium follows an added `.lr-dark`; otherwise no effect | No effect until `adoptLyraTokens(root)` or the next Lyra connect under a scope there | behaviour change |

### Examples

```html
<!-- Re-theme one region: mark it, then set inputs on it. -->
<section data-lr-theme-scope style="--lr-theme-color-brand-fill-loud: #7c3aed">
  <lr-button variant="brand">Save</lr-button>
</section>

<!-- Mode scopes are already scopes; a marked region inside one keeps its mode. -->
<aside class="lr-dark"><div data-lr-theme-scope style="--lr-theme-space-m: 1rem">…</div></aside>

<!-- A single re-themed component. -->
<lr-button data-lr-theme-scope style="--lr-theme-color-brand-fill-loud: #7c3aed">Save</lr-button>
```

```js
// An application component whose shadow root holds scopes before any Lyra element connects in it.
import { adoptLyraTokens } from '@aceshooting/lyra-ui/utilities/tokens.js';
adoptLyraTokens(this.shadowRoot);
```

```css
/* Server-rendered pages, and pages that want application elements themed before any Lyra element
   connects: pin Lyra's layer order first, then link the static layer. */
@import '@aceshooting/lyra-ui/theme.css';
@import '@aceshooting/lyra-ui/tokens-root.css';
```

## Composition and interaction

**Adoption points.** Custom properties inherit across shadow boundaries; selectors do not. One
declaration on `:root` therefore reaches every Lyra element, but a scope only works if the layer is
adopted in the tree scope that contains it:

1. **The document.** `LyraElement.connectedCallback()` adopts the layer into `ownerDocument`,
   synchronously, before Lit's first update. Every connect checks the sheet is still present.
2. **An application shadow root, on demand.** When a connecting element's root node is a shadow root
   whose host is not a library component, and the element is a scope or has a scope ancestor inside
   that root (one `closest()` over the scope list, which stops at the tree boundary), the layer is
   adopted there too. `LyraElement` re-checks when its own `data-lr-theme` or `data-lr-theme-scope`
   changes. A library component is one whose constructor was registered through `defineElement()`,
   checked through the `Symbol.for`-keyed registration registry that already backs
   duplicate-registration diagnostics, not with `instanceof`, so it works across copies. A consumer
   subclass of the public `LyraElement` is therefore foreign. Library components' own shadow roots
   never receive the layer, and none of them uses a mode scope internally.
3. **Explicit.** `adoptLyraTokens(root)` for a root whose scopes appear after its Lyra elements
   connected, or that has scopes but no Lyra element yet.

Adoption is on demand because it is not free: adopting the sheet into every application root that
contains a Lyra element cost Chromium 10–23 % more style recalculation and WebKit up to 25 % on a
mode switch (Run 10), while on-demand adoption left Chromium no slower (Run 12). `:host` is not a
scope for the same reason (Run 11) and because it would make the same markup behave differently
depending on shadow structure; a marker on the host element does the same job from the outer tree.

The same points can deliver RFC 0001's resolver into foreign roots (its open question 12).

**Wholesale replacement.** Lit's own `adoptStyles()` assigns `adoptedStyleSheets` wholesale when an
application component creates its render root. For a client-rendered component that happens before
its Lyra children connect, so ordinary use is unaffected. Two cases are not: a server-rendered
application component that upgrades after the Lyra elements inside its declarative shadow root, and
an application that later replaces the array of a root or of the document. Both remove the layer
there until another Lyra element connects (change 8). The documentation says "append, never
replace"; the `tokens-root.css` link that server-rendered application roots carry (see *Platform*)
covers the first case; the development build re-checks on every Lyra update and warns once.

**Nesting.** Scopes nest like inheritance: a scope re-derives from the inputs and switches it
inherits plus the ones set on it, and its descendants inherit the result until the next scope. An
output set on an ancestor survives only until the next scope, because every scope re-declares all
290 outputs. Component states (hover, active, variants, sizes) are unaffected; they resolve per host
from component-local tokens.

**Observers.** Canvas components repaint through `internal/theme-watcher.ts`, `watchDarkTheme`
(`code-block/shiki-dark-theme.ts`) and `lr-zoomable-frame`, which filter attribute mutations.
Marking an element that already carries inline inputs changes tokens through that one attribute, so
all three filters gain `data-lr-theme-scope`, `data-lr-design-token-mode` and, for `watchDarkTheme`,
the `data-lr-theme` it lacks today. RFC 0001 adds its axis attributes.

**Iframes, moved elements, two copies.** Each document gets its own sheet, constructed through that
document's `defaultView.CSSStyleSheet`. An element moved with `adoptNode()` re-runs the check on
connect. A document without a browsing context is skipped until the element connects to a real one.
The cross-document `<style>` fallback keeps working and gets 34 KB smaller per root. Two copies each
adopt their own sheet (change 9); both recognise each other's components through the shared
registry.

**Cascade layers and RFC 0001.**

- The layer declares only `--lr-*` outputs and the two switches. `theme.css`, the looks and RFC
  0001's axis layers declare `--lr-theme-*` inputs and private slots. On an element that is both an
  axis boundary and a scope, outputs read the inputs the resolver computes on that same element,
  because `var()` in a custom property resolves against the element's own computed values.
- `theme.css` stops declaring the focus-ring composite (change 11), so no output name has two Lyra
  owners and Lyra's layer order decides no token value.
- RFC 0001's `lr-theme-preset.mode` rules write the same switches for `[data-lr-mode]` and outrank
  the layer's v21-compatible mode rules, which keep pages without `theme.css` working.
- Every attribute through which an axis sets inputs on a subtree is a scope, and a gate fails any
  shipped rule that declares a layer-consumed input on a selector outside the list, including
  `design-tokens.css`.
- Looks set inputs, not outputs: an output declared in `lr-theme-preset` on `:root` would not be
  restated at nested scopes.
- **Pages with no Lyra stylesheet** get the layer order from the adopted sheet, which comes after
  every document stylesheet, so Lyra's layers are ordered after the application's (for example
  Tailwind's `theme, base, components, utilities`). Only application rules that declare `--lr-*`
  outputs on a scope element can conflict (change 7). The documentation recommends declaring Lyra's
  order first, as the example above does, or leaving such overrides unlayered.

**Loading, empty and error states; focus and keyboard; narrow allocation.** Not applicable: nothing
here changes component behaviour. If adoption cannot happen (a detached document), the element keeps
rendering and the development diagnostic reports the missing layer.

## Accessibility, localization, and RTL

- **Forced colours.** The arm is declared at every scope and on every host. With `theme.css`, the
  three forced-colours passes, one with unlayered application colour overrides on `:root`, match v21
  in all three engines for every scoped form, apart from the focus-ring value noted in *Parity*.
  Human review in Windows High Contrast remains pending.
- **Reduced motion.** The arm is declared at every scope and on every host, with
  `--lr-transition-interactive` re-derived on the host; the per-element safety net (`:host *`) stays
  in each shadow sheet. Both reduced-motion passes, one with unlayered application motion overrides,
  match v21 in all three engines.
- **Contrast and transparency preferences.** No arm exists today. Any future one follows the
  both-ways rule and its gate.
- **Zoom.** Unaffected: unregistered custom properties substitute token streams, and `rem` and `em`
  resolve where the property is used, not where it is declared.
- **RTL.** The safe-area aliases stay per host, so direction still resolves per element; the
  `dir="rtl"` form is identical everywhere. On desktop the insets are 0, so the test plan adds
  non-zero emulated insets and an `ltr` island inside `rtl`.
- **Semantics, names, stateful ARIA, focus return, live regions, forms, strings, locale
  formatting.** Unaffected: nothing touches markup, events or copy.
- **Contrast gates.** Token values do not change. `check-contrast.mjs`, `generate-chart-palette.mjs`
  and `generate-design-tokens.mjs` split today's per-host fragments at fixed markers; they move to
  the canonical source or the generated layer and keep checking the same values.

## Platform, security, and packaging

**Server rendering and hydration.** Declarative shadow roots stop carrying the layer. They still
carry each component's own CSS (about 17 KB for `lr-button`), which is outside this RFC.

| Server-rendered `lr-button` elements | A: raw / gzip / Brotli | E: raw / gzip / Brotli |
|---:|---:|---:|
| 1 | 52,828 / 6,586 / 5,429 | 18,690 / 3,221 / 2,741 |
| 10 | 527,578 / 63,566 / 5,436 | 186,198 / 4,759 / 2,751 |
| 100 | 5,275,078 / 633,380 / 5,436 | 1,861,278 / 17,013 / 2,750 |

Gzip's 32 KB window cannot deduplicate A's per-element block; Brotli can. For first paint before
hydration, the page links `tokens-root.css` in `<head>`, after the no-flash bootstrap and with
`theme.css`. Hydration then skips the constructed copy (see *First adoption*); a copy would declare
the same values in the same layer, so document-level scopes do not repaint either way. Scopes inside
an application's *own* declarative shadow roots are outside the document's reach until hydration
adopts the layer there, so such roots include `<link rel="stylesheet" href="…/tokens-root.css">`
(open question 12 asks whether the server helper emits it). `check-ssr.mjs` asserts that no
declarative shadow root carries a layer declaration. The `ssr-loader.js` removal (roadmap item 33)
is independent.

**No-flash bootstrap.** Unchanged: it writes mode attributes and inline inputs on `<html>`, which is
always a scope. Lyra elements cannot flash, because the layer is adopted before their first update.
Application elements that read outputs change value at that first connect (change 6); pages that
care link `tokens-root.css`.

**First adoption.** Adopting the layer into a document that already has a large application DOM
invalidates style for the whole document once. With 20,000 application rows and no Lyra element yet,
connecting the first `lr-badge` took 64 ms instead of 10 in Chromium, 47 instead of 9 in Firefox,
and 183 instead of 17 in WebKit (`late-adopt.mjs`, 5 runs, medians, load 6–8). Lazily loaded routes
pay this once per document. Pages that link `tokens-root.css` avoid it: the static file declares a
private sentinel on `:root`, and the first connect in a document skips the constructed copy when one
computed-style read finds it. The spike did not prototype the skip; the release gate measures it.

**Browser support.** `Document.adoptedStyleSheets` and `ShadowRoot.adoptedStyleSheets` exist in
every browser above the v22 floor (roadmap item 35: Firefox 125, Safari 17). The switches need only
empty and `initial` custom-property values; the parity suite exercises them in all three engines.

**Security.** Constructed stylesheets are not inline `<style>` elements, so a strict `style-src`
policy is unaffected. The layer contains no URLs and no remote content.

**Side effects and tree shaking.** Nothing new runs at import time; adoption happens on connect, so
class modules stay free of side effects and the `sideEffects` inventory does not change.
`adoptLyraTokens` and `findUnscopedThemeInputs` live in their own side-effect-free modules.

**Package and bundle cost.** Neutral. The six-component spike bundle is 77,179 bytes gzip for A and
77,447 for E (+268). The generated implementation replaces the per-host fragments. `tokens-root.css`
becomes the whole layer: 24,072 bytes raw and 3,736 gzip, against 24,858 and 2,170 for today's
curated subset. No new dependencies.

## Compatibility and migration

**Semver.** Major, in v22. Changes 1–4 are breaking, and 5–9 and 13 change visible behaviour. No
public name is renamed or removed, so the rename policy's deprecated aliases do not apply.

**Migration profile.** The `lyra-ui-migrate --origin=lyra-v21` profile ([RFC
0003](0003-lyra-v21-migration-profile.md)) gains the structural rule `theme-scopes`. Its reports use
that profile's format and code-qualified acknowledgements:

- **Markup.** In HTML, JSX and Lit templates, an element whose inline `style` sets a layer-consumed
  input and that is not a scope gets `data-lr-theme-scope`. The rule covers `style` attributes,
  `styleMap()` keys and JSX style objects. A marker changes nothing where no unscoped input or
  output sits above it: with the switches, a redundant scope re-derives the same values in any mode.
- **Repeated elements.** A marker inside a loop makes every rendered element a scope of about 300
  declarations. The report flags markers added in repeated templates and suggests moving the inputs
  to a common ancestor scope.
- **Dynamic inputs.** `style.setProperty('--lr-theme-…')` calls and spread style objects are
  reported, not rewritten.
- **CSS.** Every rule that declares a layer-consumed input on a selector outside `:root`, `html` and
  the scope list is reported with file, line and selector, including `:host`, `:host(…)` and
  `::slotted()` rules: the matched elements need the marker.
- **Outputs.** Every declaration of a shared output outside a scope is reported: with "its
  dependants no longer follow it" when the output feeds others (change 2; set the input on a scope,
  or mark the element), and with "now reaches deeper" in every case (change 3).

**Development diagnostic.** In v22, under the `development` export condition, the first connect in
each scope walks the ancestor chain, the host included, up to the nearest scope, and warns once per
scope for an inline layer-consumed input on an element that is not a scope. It also warns on a
`"false"` marker value and when the layer is missing from its root. It reads no computed style.
Stylesheet-applied inputs and later `setProperty()` calls are left to the migration report and to
`findUnscopedThemeInputs()` (open question 5).

**21.x.** The `development` condition does not exist before v22, so 21.x ships no automatic warning:
`findUnscopedThemeInputs()` is called explicitly, in development or in tests, and logs nothing, so
the strict-console CI lanes are unaffected.

**Fallbacks.** Any marker value marks a scope. A page with no adoption at all (JavaScript disabled,
no static link) renders declarative shadow DOM without resolved tokens, as a page without Lyra's
styles does today.

## Alternatives considered

1. **Keep per-host declarations.** Keeps subtree re-theming implicit and every cost in *Motivation*.
   The outcome if this RFC is rejected, or if the release gate fails and the maintainers defer.
2. **Move only the input-free literals (compatible).** Variant C moves the 56 literal-only
   properties (the ramp and the mask constant). It renders identically to v21 everywhere and has no
   measurable effect on time or memory in any engine, so it is not a useful separate step.
3. **A document layer with no scopes.** Breaks every nested theme, including `.lr-dark` regions.
4. **Detect scopes automatically.** Observing `style` attributes costs script time on every mutation
   and still misses stylesheet-applied inputs.
5. **Mode by duplicated dark rules at the mode scopes (the first draft, variant D).** Every
   mode-neutral scope then re-derives the light fallbacks, so without `theme.css` a marked region in
   a dark page renders light. Per-mode private slots (one per mode-dependent output, set at every
   mode scope) would fix that too, at 55 more declarations per mode scope; the two switches cost
   two.
6. **`light-dark()` or style queries for mode.** `light-dark()` covers colours only and needs Safari
   17.5, above the floor; style queries on custom properties are not available at the Firefox floor.
7. **Preference arms only at the scopes.** Then an unlayered application override on `:root` or a
   wrapper defeats reduced motion and forced colours inside components, which v21 prevents.
8. **`:host` of an application root as a scope.** Every application component that contains a Lyra
   element becomes a scope: Chromium style recalculation +53 % at 1,000 elements and memory +12 % at
   3,000 (Run 11). A marker on the host gives the same result where it is wanted.
9. **Adoption into every application root, or explicit adoption only.** The first costs Chromium and
   WebKit measurably (Run 10); the second silently breaks `data-lr-theme="dark"` on a Lyra host
   inside an application root (open question 2).
10. **Move the specialist palettes into the layer.** Adds 48 declarations to every scope for 13
    component types; they stay per host (open question 9).
11. **Resolve every use site against inputs and drop the output layer.** Duplicates every default
    into hundreds of stylesheets and cannot express mode-dependent defaults without per-host rules.
12. **Register tokens with `@property`.** Does not change where `var()` is substituted, and needs
    initial values that do not depend on other tokens.

Prior art in public documentation has the same shape: Web Awesome documents themes applied at the
root or scoped to an element ([Customizing and theming](https://webawesome.com/docs/customizing)),
and shadcn/ui declares its theme variables on `:root` and again under `.dark`
([Theming](https://ui.shadcn.com/docs/theming)).

## Test, documentation, and rollout plan

**Tests**

- Promote `parity-e` and `parity-modes` to a permanent multi-engine suite over every registered
  component: the 30 forms and 15 page modes (with and without `theme.css`, the shadcn look,
  application overrides of published outputs), plus a scope added to an application root after its
  Lyra elements connected. Expected: v21 parity for scoped forms, the documented semantics for
  changes 1–5, and the nearest mode scope's mode everywhere.
- `check:host-token-declarations`, built on a CSS parser (postcss), not a regex: no component or
  shadow sheet declares a layer name outside the host-local set and the generated preference arms.
  None does today (every textual match is comment prose).
- Generator gates: the adopted layer and `tokens-root.css` are byte-identical CSS generated from
  `canonical-tokens.json`; every media-conditioned output arm is emitted at the scopes and on the
  host, with its derived set; the scope list covers every shipped rule that declares a
  layer-consumed input (`theme.css`, `design-tokens.css`, the looks, RFC 0001's axes); the input
  split is current.
- Runtime tests: one adoption per document; re-adoption after the application replaces
  `adoptedStyleSheets`, including after every element has connected; on-demand adoption into
  application roots and a consumer `LyraElement` subclass, never into library roots, and none into a
  root without scopes; re-checking when a host's own `data-lr-theme` changes; skipping the
  constructed copy when `tokens-root.css` is present; an element moved into an iframe; a document
  without a browsing context; two copies; the observers reacting to the marker; the development
  diagnostic, including the `"false"` value. `production-theme.test.ts`'s focus-ring
  precedence assertions move to the layer, which now owns those names.
- Server rendering: `check-ssr.mjs` asserts no layer declaration in declarative shadow roots; a
  fixture with `tokens-root.css` linked renders with JavaScript disabled, and a visual capture
  confirms it.
- Visual captures for scopes nested three deep in light, dark, OS dark and forced colours, with and
  without `theme.css`; RTL with non-zero emulated safe-area insets and an `ltr` island.
- **Performance release gate.** Before 22.0, re-run the harness against the implementation, on an
  idle machine, in all three engines: initial render, deferred flush, and mode, accent and spacing
  changes, for no scopes, 50 nested scopes, a scope on every row, and every row inside an
  application shadow root, plus the first adoption with and without `tokens-root.css`. Any
  regression whose interquartile ranges separate from v21's blocks the switch until it is removed or
  explicitly accepted (open question 13). The numbers go into the release notes.

**Documentation.** Rewrite "Where an override actually reaches" in `llms/shared.md` around scopes
and the input split; add a "Theme scopes" section to the theming guide with nested examples, the
foreign-root rules, the layer-order recommendation and "append, never replace"; replace the
three-dark-routes section of `docs/agents/i18n-rtl-theming.md`; update `docs/design-token-system.md`
and the `tokens-root.css` header; add a Storybook story with nested scopes, a scoped override and an
application shadow root; regenerate `llms/`, the manifest and editor data, then run `./package.sh`.

**Rollout**

1. **21.x, compatible.** Document `data-lr-theme-scope` (inert for components, which re-derive
   anyway), recognise it in `tokens-root.css`, and ship `findUnscopedThemeInputs()`.
2. **v22 pre-release.** Switch `LyraElement` to the document layer; land the parity suite, the
   gates, the SSR assertions, the observers and the `theme-scopes` rule; run the release gate.
3. **22.0.** Release with the migration profile, the measured numbers and the server-rendering note.

**Rollback.** Before 22.0, reverting is internal: restore the per-host fragments; markers stay
harmless. After 22.0, reverting is itself breaking (change 3 in reverse), so the pre-release settles
it.

## Unresolved questions

Numbers are stable, because RFC 0001 cites them; closed questions keep their place.

1. **Marker name.** A dedicated `data-lr-theme-scope`, an empty `data-lr-theme`, or a class such as
   `lr-theme-scope`. RFC 0001's axis attributes may make a dedicated marker rarely necessary.
2. **Adoption into application roots.** On demand (proposed) misses a scope added to a root after
   its Lyra elements connected, until the application calls `adoptLyraTokens()`; adopting into every
   root costs Chromium and WebKit measurably (Run 10); explicit-only adoption silently breaks
   `data-lr-theme="dark"` on a Lyra host inside an application root. Is on demand the right default,
   and does it need an opt-out, given that it appends to an application-owned array?
3. **Closed: nested `.light` and `.dark` under the fixed shadcn stylesheet.** Bare `.light` and
   `.dark` remain mode-neutral scopes while the fixed stylesheet is supported, through at least v23,
   and leave with that stylesheet no earlier than v24; RFC 0001 scopes
   the switchable look's aliases.
4. **Closed: composite components re-declaring shared outputs.** None do: every textual match is
   comment prose, and no parsed component sheet declares a layer name. The parser-based gate keeps
   it that way.
5. **Diagnostic depth.** Should the development build also sample computed styles to catch
   stylesheet-applied inputs, and on how many elements?
6. **Two copies.** Accept "later-adopted layer wins", or version the sheet and warn when two differ?
7. **Closed: layer placement.** The layer stays in `lr-theme` (RFC 0001).
8. **Stable names.** Should the stable subset documented for `tokens-root.css` grow, now that every
   output is visible on `:root`?
9. **Specialist palettes.** Move them into the layer in 22.x, or keep them per host?
10. **Pending human evidence.** Windows High Contrast review; a run on representative mobile
    hardware; scrolling and animation on pages with many scopes.
11. **Per-family scopes.** Each scope re-derives all 290 outputs. The generator could have each axis
    attribute re-derive only the outputs that depend on the inputs that axis sets (density only the
    spacing family, mode only the 55 paired outputs and their dependants), keeping the full set for
    the neutral marker. This is the main lever if the scope regressions hold.
12. **Server-rendered application roots.** Should the server helper emit the layer once per
    response, and a `tokens-root.css` link inside application declarative shadow roots, making
    change 4 non-breaking?
13. **Accepting a measured regression.** If the release gate confirms a regression with scopes on an
    idle machine and per-family scopes do not remove it, ship with the documented cost or defer?

## Appendix A: evidence summary

**Method.** [`0002-evidence/README.md`](0002-evidence/README.md) defines the variants and the
harness; [`results.md`](0002-evidence/results.md) has every table. In short: `theme.css` is loaded;
N elements cycle through `lr-button` (brand), `lr-input` (label, placeholder), `lr-card`, `lr-badge`
(success), `lr-icon` and `lr-switch` (checked), six to a flex row; the "no card" mix drops
`lr-card`. A batched insert sets `innerHTML` once (`setHTMLUnsafe()` for application shadow roots,
written as declarative shadow DOM on plain hosts); streamed rows append one row at a time and force
style and layout after each. Metrics: insert to first full style and layout (through every
`updateComplete` to a forced `offsetHeight`); the deferred flush (the final forced style and layout
alone); Chromium's `RecalcStyleDuration`; a re-theme (one change on `<html>` and a forced flush,
median of 7 toggles: `data-lr-theme` light/dark, an inline accent input, an inline spacing input);
and growth in proportional set size over the browser's process tree (Chromium collects garbage
first). Each measurement uses a fresh browser; variant order alternates between runs; tables give
medians with interquartile ranges.

**Machine.** Intel Core i7-7820X (8 cores, 16 threads, 3.6 GHz), 61 GiB RAM, Linux 7.0, Node
22.23.2, Playwright 1.63.0 with Chromium 153.0.8010.12 (headless shell), Firefox 155.0 and WebKit
26.6. The machine was shared with other work in every run; treat single-digit differences as noise
unless the interquartile ranges separate. Memory growth is not sensitive to load.

| Run | Scenario | Variants | N | Load average |
|---|---|---|---|---|
| 1 | Six-type mix, batched insert (7 runs per cell) | A, B | 200, 1,000, 3,000 | 3–5 |
| 2 | No `lr-card`, rows streamed | A, B | 1,000, 3,000 | 12–21 |
| 3 | No `lr-card`, batched insert | A, B | 1,000, 3,000 | 9–16 |
| 4 | No `lr-card`, rows streamed | A, B, D | 3,000 | 7–9 |
| 5 | Six-type mix | A, C | 1,000, 3,000 | 10–45 |
| 6 | 50 nested scopes (ten chains of five) | A, D | 1,000, 3,000 | 9–20 |
| 6b | The same, Chromium only | A, D | 1,000 | about 23 |
| 7 | Six-type mix | A, E | 1,000, 3,000 | 8–14 |
| 8 | 50 nested scopes | A, E | 1,000, 3,000 | 8–32 |
| 9 | A scope on every row | A, E | 1,000, 3,000 | 32–39 |
| 10 | Every row in an application shadow root, adoption into every root | A, E | 1,000, 3,000 | 14–39 |
| 11 | As 10, each application host also a scope | A, E | 1,000, 3,000 | 6–14 |
| 12 | As 10, adoption only where a scope needs it (the proposal) | A, E | 1,000, 3,000 | 5–13 |

Runs have 5 runs per cell unless noted. Runs 7–11 and the first-adoption measurement used the E
build before the `.light` and `.dark` scopes and on-demand adoption were added; none of their pages
contains a `.light` or `.dark` element, and Run 10 is the adopt-everywhere behaviour that the final
build reproduces with `--foreign-always`. Run 12, the parity matrix and the structure counts used
the final build. Results files from Run 7 on record their bundle hashes, page parameters and load
averages; every run used one source commit.

**Structure** (custom properties a host declares rather than inherits; identical in the three
engines, except that Firefox counts 560 on E's root):

| Variant | On `:root` | `lr-button` | `lr-input` | `lr-card` | `lr-badge` | `lr-icon` | `lr-switch` |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 273 | 339 | 310 | 290 | 316 | 289 | 304 |
| D | 559 | 53 | 24 | 4 | 30 | 3 | 18 |
| E | 561 | 53 | 24 | 4 | 30 | 3 | 18 |

**Input consumption** (`analyze-inputs.mjs`: 1,459 built modules, 296 distinct CSS texts parsed with
postcss). The shared sheets declare 293 names and read 216 inputs (215 in the layer, one
host-local); the specialist sheet reads 48; component sheets read 11 directly; no component sheet
declares a shared name.

**Other.** In Chromium, the first render of 600 instances of one type forces one style recalculation
for `lr-button`, `lr-input`, `lr-badge` and `lr-icon`, two for `lr-switch`, and 1,800 (with 601
layouts) for `lr-card`, which derives its accessible text from computed style during its first
update, in A and in the prototypes alike.
