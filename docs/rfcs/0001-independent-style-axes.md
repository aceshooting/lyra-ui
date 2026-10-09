# RFC 0001: Independent style axes

- **Status:** Implemented
- **Decision:** Accepted by the maintainer on 2026-09-27. The four feasibility items under "Stage 1 merge
  gates" were not waived. Anything first deprecated in 22.0.0 remained supported through v23 and was
  removable no earlier than v24 ([RFC 0003](0003-lyra-v21-migration-profile.md), question 11). The
  design shipped in 22.0.0; the [implementation note](#implementation-note-2700) records what changed
  afterwards, and each unresolved question carries its disposition.
- **Authors:** Lyra UI maintainers
- **Created:** 2026-09-27
- **Tracking issue:** None yet; this RFC is item 1 of the v22 plan's "Themes and styling" list in
  [`docs/roadmap.md`](../roadmap.md) and the prerequisite for items 2–8. It interacts with
  [RFC 0002](0002-tokens-once-per-document.md) (tokens once per document, item 30) and
  [RFC 0003](0003-lyra-v21-migration-profile.md) (the v21 migration profile).
- **Supersedes / superseded by:** None

## Summary

Replace the theme runtime's single token-preset slot with five independent, persisted style axes:
**look**, **surface**, **density**, **mode** and **accent**. Each axis has its own attribute, usable on
`<html>` for the whole document or on any element for one subtree, its own sublayer inside
`lr-theme-preset`, and its own reset. Changing one axis never disturbs another.

Nesting axes independently requires every value to resolve against the nearest ancestor for *each*
axis, but a custom property resolves `var()` where it is declared. This RFC therefore separates
choosing from resolving. Looks and accents write private per-mode **slots**, Lyra's mode rules flip
two private **switches**, and a generated **resolver** in `theme.css` recomputes the public
`--lr-theme-*` inputs on every element that carries a mode, look, accent or density attribute. This
works for every value type and needs no browser feature above the current floor. It keeps v21's
behaviour for mode islands, unlayered overrides and application `color-scheme`, apart from one listed
input. A disposable prototype confirms it in Chromium, Firefox and WebKit:

- component rendering is identical to v21 in every mode context;
- every nesting case tested resolves each axis from its nearest ancestor;
- mode switches cost within measurement noise of v21;
- `theme.css` grows by 2.55 KB gzip, and the shadcn look shrinks by 1.0 KB.

A new `setLyraStyle()` family in the zero-dependency `@aceshooting/lyra-ui/theme.js` becomes the
canonical API. It shares v21's runtime, storage key, contrast floor and no-flash bootstrap.
`setLyraTheme()` and the theme-preset API remained as a deprecated facade through v23 (removed in
24.0.0). [Staged delivery](#staged-delivery) then orders the rest: token foundations, density and
glass, the Material-inspired look, chart palettes for each look, and the preset gallery.

## Implementation note (27.0.0)

The design below shipped in 22.0.0 as written, with the staged delivery order and the five axes
(`look`, `surface`, `density`, `mode`, `accent`). Later releases changed the following; the rest of
this document keeps the original wording, so read it with these in mind.

- **22.0.0.** `setLyraStyle()`/`getLyraStyle()`/`resetLyraStyle()`, `lr-style-change`,
  `lyraStyleAttributes()`, `lyraLookCss()`/`defineLyraLook()`, the `shadcn` and `lyra` looks in
  `theme.css`, the Material-inspired look (id `material`, `theme/looks/material.js`; `data`,
  `terminal` and `high-contrast` looks followed), density, glass, the generated resolver, the
  version-2 storage record and the extended bootstrap. The deprecated facade (`setLyraTheme()`,
  `getLyraTheme()`, the preset API, `lr-theme-change`, `themes/shadcn.css`) shipped beside them.
- **24.0.0.** The facade was removed: `setLyraTheme()`, `getLyraTheme()`, `LyraTheme`, the preset
  API and `data-lr-theme-preset`, `lr-theme-change`/`lr-theme-preset-change`, `theme/presets.js`,
  `theme/presets/shadcn.js` and `themes/shadcn.css`. `theme.css` includes the `shadcn` look and
  `lyra`; `lyra-ui-migrate --origin=lyra-v22` reports each removed name
  ([RFC 0003](0003-lyra-v21-migration-profile.md)). References to "the facade", "deprecated" rows
  and "removal no earlier than v24" below describe the 22.0.0 state.
- **25.0.0.** The built-in defaults changed from the `lyra` look, solid surface and no accent to
  `shadcn`, `glass`, `emerald` and `system` mode, shared by first paint, restoration and
  `resetLyraStyle()`; `accent: null` stays an explicit clear. The "Default" column of the axes
  table has been refreshed. Saved choices stay independent and win. In 25.6.2 the default Glass
  opacity became 60% (`--lr-theme-surface-opacity`); 25.0.0 had set 70%.
- **27.0.0.** RFC 0002 delivered the document-level token layer, so a scope is any element carrying
  a style-axis attribute or `data-lr-theme-scope` (`lyra-ui-migrate --rule=theme-scopes`).

No new feature is added by this status change.

## Motivation

### What exists today

This proposal extends the existing foundation rather than adding a second theme engine:

- `theme.css` declares every `--lr-theme-*` input in the `lr-theme` layer:
  - a light rule on `:root, .lr-light, [data-lr-theme='light']`;
  - a dark rule on `.lr-dark, [data-lr-theme='dark']`, which re-declares 111 inputs.

  A mode island re-declares those inputs, so an unlayered application override on `:root` does not
  reach it.
- `themes/shadcn.css` is an opt-in look in `lr-theme-preset`. It applies to the whole page as soon as
  it is imported, and it also answers to `.light` and `.dark`.
- `theme.js` provides `setLyraTheme({ mode, accent, surface, tokens })` and `getLyraTheme()`. The
  runtime:
  - persists one record under `localStorage['lyra-theme']`;
  - derives contrast-checked accent ramps;
  - writes a validated `--lr-theme-*` token map inline on `<html>`, floored against each resolved
    mode;
  - shares its ownership list with the bootstrap;
  - dispatches `lr-theme-change`.
- The no-flash bootstrap (`lyraThemeBootstrap`, `createLyraThemeBootstrap()` and the static
  `theme-bootstrap.js` asset) restores that record before first paint. It measures 3,980 bytes gzip
  against a ceiling of 4,060.
- `theme/presets.js` provides `defineLyraThemePreset()` and `applyLyraThemePreset()`, the built-in
  presets, the `data-lr-theme-preset` marker and `lr-theme-preset-change`. `theme/presets/shadcn.js`
  is generated from `themes/shadcn.css`.
- `tokens/canonical-tokens.json` is the token inventory. The token grammar
  (`scripts/fixtures/theme-token-grammar.json`) is shared by the runtime, the bootstrap, the preset
  validator and the generators.
- Every component re-derives its resolved `--lr-*` layer from the `--lr-theme-*` inputs on its own
  `:host`. RFC 0002 measures this at 293 unconditional declarations per host.

### What does not work

1. **One slot carries every non-colour choice.** A look, a density and a glass treatment would all
   compete for `tokens`, and each map replaces the previous one. Switching looks would drop the
   density. Resetting only the density would require knowing which entries came from which choice,
   so every application would have to keep that record itself, and any mistake leaves stale
   overrides behind.
2. **Looks cannot be scoped.** A look applies either to the page (stylesheet) or inline on `<html>`
   (runtime preset). Nothing can express a shadcn-styled embedded panel, a compact table inside a
   comfortable page, or a glass rail over solid content. The documentation already records that a
   mode island drops runtime token maps and accent ramps.
3. **Mode is encoded in selectors.** Every look repeats itself once for each mode selector.
   - `theme.css` does not answer to `.dark`, so 156 of the 248 input declarations in
     `themes/shadcn.css` repeat `theme.css`'s value for the same mode (79 light and 77 dark,
     comparing whitespace-normalized values; 154 of them sit in the block marked as repeated).
   - When look islands and mode islands are nested, source order decides the winner, not the
     nearest ancestor.
4. **Names are already taken.**
   - `LyraTheme.surface` is the colour the accent ramp is mixed against, while the roadmap's surface
     axis is a treatment.
   - The runtime spells the operating-system mode `auto`, while the built-in preset spells it
     `system`.
   - `data-lr-theme` holds the resolved mode on `<html>` but is also hand-written on islands.
5. **Density has no independent home.** Form-control heights and `--lr-theme-icon-button-size` are
   look inputs, and the shadcn look already changes them. A density preset made of absolute values
   would overwrite them.

This belongs in Lyra because the runtime, the grammar, the contrast floor, the bootstrap and the input
contract are all Lyra's. Only the library can guarantee contrast, target size and pre-paint
restoration across combinations of its own choices. An application can already set inputs per
subtree, but it then gets no persistence, validation, pre-paint restoration, reset semantics or
guarantees that hold across combinations.

## Goals and non-goals

### Goals

- **Five axes, each a separate persisted choice:**
  - **look**: colour roles, shape, type, elevation, base geometry and chart palettes;
  - **surface**: `solid`, or regular `glass`;
  - **density**: `compact`, `comfortable` or `touch`;
  - **mode**: `light`, `dark`, `system`, or `unset` for application-owned modes;
  - **accent**: a named accent, a custom colour, a per-role record, or the look's own.
- **Independence.** Changing or resetting one axis never changes another axis's stored choice or
  owned overrides, and never leaves obsolete inline values behind. Derived appearance is recomputed:
  compact density scales the new look's base geometry, and an accent adapts to its reference surfaces.
  Independence does not promise identical pixels or identical derived token values after a look change.
- **Scopes.** Every axis works at document scope and at element scope. A scoped element takes each
  axis from its nearest ancestor that sets it, independently of the other axes, through nested
  shadow roots.
- **One definition per look.** The runtime and stylesheet forms of every look are generated from one
  authored definition. They are validated by the existing token grammar and exported through the
  existing interchange formats.
- **Closed sets as attribute-selected stylesheets.** Density presets, surface treatments and named
  accents are small closed sets. Each is authored once and shipped as a stylesheet selected by
  attribute. Custom accent colours exist only in runtime form.
- **Before first paint.** Choices are restored before first paint, the axis attributes can be
  rendered on the server, and system mode resolves without JavaScript.
- **v21 parity.** With no new attribute, import or call, a v22 page renders exactly as it did in v21.
  That includes mode islands, unlayered overrides and application `color-scheme`. The exceptions are
  the listed [behaviour changes](#compatibility-and-migration).
- **No floor raise.** The browser floor is unchanged beyond the Popover floor that the roadmap
  (item 35) already plans.
- **A defined deprecation path.** Every v21 theming surface is either compatible in v22, or
  deprecated in v22 and supported through v23, with removal no earlier than v24.

### Non-goals

- A second theme engine. The new API reuses the v21 runtime, grammar, contrast floor, ownership list
  and bootstrap.
- Changing DOM, events, keyboard behaviour, focus order or ARIA based on an axis. Axes are CSS-only
  apart from canvas repaints and the measured length reads described below. A look that needs a
  structural difference gets a new shared input (item 2) or component work, never a look-specific
  component.
- Exact rendering or behavioural parity with any design system. The Material-inspired look promises
  no ripple and no shape morphing. Glass promises no pointer-driven distortion and no refraction.
- The full visual theme builder, which is v23 work. The v22 gallery previews and exports only.
- Persisting scoped choices, which belong to application state. Syncing tabs through the `storage`
  event: the runtime re-reads storage on every `getLyraStyle()`, as `getLyraTheme()` does today.
- Palette editor UI and item 7's further looks, which are v23 work. Categorical, sequential and
  diverging palette foundations are all required for the initial v22 release.

## Proposed public contract

Status legend: **new**; **compatible** (meaning unchanged); **deprecated** (works through v23,
removable no earlier than v24); **breaking** (changed in v22).

### The axes

| Axis | Values | Default | Attribute | Owns |
| --- | --- | --- | --- | --- |
| look | `lyra`, `shadcn`, `material`, `data`, `terminal`, `high-contrast`, application ids | `shadcn` (`lyra` through 24.x) | `data-lr-look` | every `--lr-theme-*` input not owned below; role ramps through look slots |
| surface | `solid`, `glass` | `glass` (`solid` through 24.x) | `data-lr-surface` | `--lr-theme-surface-opacity`, `-blur`, `-saturation`, `-highlight` |
| density | `compact`, `comfortable`, `touch` | `comfortable` | `data-lr-density` | private scale factors and target floor |
| mode | `light`, `dark`, `system`; `unset` (runtime only) | `system`; with no attribute `theme.css` follows `prefers-color-scheme` (light through 24.x) | `data-lr-mode` (requested); `data-lr-theme` (resolved) | private mode switches and `color-scheme` |
| accent | the nine named accents, a CSS colour, a per-role record, `null` | `emerald` (`null`, the look's own, through 24.x; `null` remains an explicit clear) | `data-lr-accent` | role ramps, `--lr-theme-color-focus` and `--lr-theme-accent`, through accent slots |

**Look ids.** Look ids follow today's preset-id rule: lowercase kebab-case, at most 64 characters.
They form an open set, so applications can add their own. The id `custom` is reserved for a runtime
look that arrives without an id, such as a v1 record or a map passed to the facade.

**Named accents** are the nine gemstone keys: `emerald`, `peridot`, `topaz`, `ruby`, `tourmaline`,
`amethyst`, `aquamarine`, `sapphire` and `hematite`.

- In the API, a string that matches a name selects that accent before it is read as a CSS colour. So
  `'aquamarine'` is the gemstone, not the CSS keyword.
- The stored record keeps the name and the colour in separate fields, so no persisted value changes
  its meaning.
- Future names must not be CSS colour keywords, and a test enforces this.

**Mode has two attributes, each with one writer.**

- **`data-lr-mode`** holds the requested mode: `light`, `dark` or `system`.
  - It is written by server rendering, the bootstrap, `setLyraStyle()` and `applyLyraStyleScope()`.
  - `system` resolves in CSS through `prefers-color-scheme`, with no script.
- **`data-lr-theme`** keeps its v21 meaning, the resolved mode (`light` or `dark`).
  - The runtime writes it, together with `data-theme`, on `<html>` and on the scopes it manages.
  - Applications may still hand-write it on islands, as in v21, and `.lr-light` and `.lr-dark` remain
    aliases.
  - If `data-lr-mode` and `data-lr-theme` disagree on the same element, `data-lr-theme` wins.
- Every consumer selector, component fallback and observer that keys on `data-lr-theme` keeps
  working.

**`data-lr-accent`** holds a named accent, `none` or `custom`.

- `none` means the look's own accent and resets a subtree.
- `custom` is informational only. A custom colour exists only as runtime inline values.

**Absent versus explicit.**

- On a scope, an absent attribute means "inherit".
- An explicit default resets that subtree: `data-lr-look="lyra"`, `data-lr-density="comfortable"`,
  `data-lr-surface="solid"` or `data-lr-accent="none"`.
- The runtime writes every axis explicitly on `<html>`, so the root always carries the complete set of
  choices.

A component host is an element like any other, so `<lr-table data-lr-density="compact">` scopes one
table.

### Resolution model

A custom property substitutes `var()` on the element that declares it, and its descendants inherit
the result. If a look wrote a per-mode value directly, that value would stay fixed to the mode of the
look's own element. If a look aliased one role to another, the alias would stay fixed to the accent
of the look's element. To avoid both, no axis writes public inputs that need combining. Instead:

- looks write per-mode **slots**;
- accents write per-mode **accent slots**;
- mode rules flip two **switches**;
- a **resolver** combines them on every axis boundary.

```css
/* Generated; private names are illustrative and are not public API. */
@layer lr-theme {
  :root, [data-lr-look] {                         /* the Lyra look */
    --lr-theme-border-radius-m: 0.375rem;         /* mode-independent input: written directly */
    --_lr-ll-color-surface-default: #ffffff;      /* mode-resolved input: one slot per mode */
    --_lr-ld-color-surface-default: #1a1a1a;
  }
  :root, .lr-light, .lr-dark, [data-lr-theme], [data-lr-mode], [data-lr-look], [data-lr-accent] {
    --lr-theme-color-surface-default:
      var(--_lr-dark-on, var(--_lr-ll-color-surface-default))var(--_lr-light-on, var(--_lr-ld-color-surface-default));
  }
}
@layer lr-theme-preset.mode {                    /* L = light switches, D = dark switches */
  :root, [data-lr-mode='light'], [data-lr-mode='system'] { color-scheme: light; --_lr-dark-on: initial; --_lr-light-on: ; }
  [data-lr-mode='dark'] { color-scheme: dark; --_lr-dark-on: ; --_lr-light-on: initial; }
  @media (prefers-color-scheme: dark) { [data-lr-mode='system'] { /* D */ } }
  .lr-light, [data-lr-theme='light'] { /* L */ }     /* resolved attributes come last, so they win */
  .lr-dark, [data-lr-theme='dark'] { /* D */ }
}
```

**How a switch works.** A switch is either empty, which means on, or `initial`, which means off.
`initial` is the guaranteed-invalid value.

- `var()` of an off switch returns its fallback.
- `var()` of an on switch returns nothing.

So exactly one branch survives. With no whitespace between the two `var()` calls, the computed value
is the bare branch (`#ffffff`, `0.5rem`), in all three engines.

The rules that make this a contract:

- **Mode-resolved inputs** are the 111 inputs that v21's dark rule re-declares, plus any input that a
  built-in look makes mode-dependent. Today that addition is only
  `--lr-theme-color-surface-border-subtle`, for a total of 112.
  - A mode island therefore re-declares the same inputs it did in v21, so unlayered application
    overrides behave as they did in v21.
  - `check:style-axes` fails if an addition is not listed as a behaviour change.
- **Boundaries.** Every element that carries a mode, look or accent attribute is a boundary. So are
  `.lr-light` and `.lr-dark`, and the shadcn look's `.light` and `.dark` aliases inside a shadcn
  scope. The 13 density-scaled inputs resolve only at `:root`, look and density boundaries. They
  therefore keep inheriting through mode islands, as in v21.
- **A look is a delta over Lyra.**
  - The Lyra look is declared on `:root, [data-lr-look]` in `lr-theme`.
  - Each look's own rule in `lr-theme-preset.look` overrides it on the same element.
  - Inputs that only another built-in look sets (the subtle border, the heading letter spacing) are
    cleared to `initial` on every look boundary.
  - An explicit `data-lr-look="lyra"` therefore resets a subtree completely.
  - A partial application look is a delta over Lyra, never over its ancestor's look.
- **Accent before look.** For the 46 accent-owned inputs (five roles × nine ramp properties, plus
  `--lr-theme-color-focus`), the resolver reads the nearest accent slot before the nearest look slot.
  `[data-lr-accent='none']`, declared in `theme.css` beside the resolver, clears the accent slots.
- **Roles that follow brand.** A look value that is exactly `var(--lr-theme-color-brand-<channel>-<tier>)`,
  on another role's input with the same channel and tier, compiles to a private follow switch. That
  role then re-reads brand's accent-then-look chain on every boundary. This is how shadcn's primary
  (the neutral loud tier) follows a nested accent.
- **Other references** in look values resolve where the look is declared.
  - A slot may therefore reference only `--lr-theme-shadow-color`, which `check:style-axes` keeps
    mode-independent in every built-in look.
  - Built-in looks and `defineLyraLook()` reject references to mode-resolved, accent-owned or
    density-scaled inputs.
  - In maps that bypass `defineLyraLook()` (v1 records, facade calls), a value with any other
    reference stays at the root, as in v21. The runtime and the bootstrap apply this rule without
    an input list.
- **Any value type.** Slots hold whatever the input holds. Per-mode shadow geometry, lengths and
  numbers need no colour typing and no splitting.
- **The consumer focus-ring composite** (`--lr-focus-ring*`) is re-derived on every boundary as well,
  so `outline: var(--lr-focus-ring)` inside a look or accent scope uses that scope's focus colour.

### Cascade layers

The five-name statement is unchanged. New sublayers nest inside `lr-theme-preset`, so an
application that pins the documented order keeps its own layers in place. RFC 0002's layer stays in
`lr-theme`, which answers its open question 7.

```css
@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;
@layer lr-theme-preset.look, lr-theme-preset.density, lr-theme-preset.surface,
  lr-theme-preset.accent, lr-theme-preset.mode;
```

- **Placement.**
  - `theme.css` puts the Lyra look, the resolver and the accent reset in `lr-theme`, and its mode
    rules in `.mode`.
  - Looks go in `.look`, `density.css` in `.density`, `surfaces/glass.css` in `.surface` and
    `accents.css` in `.accent`.
  - Every Lyra stylesheet repeats both statements. The layer-order test checks the effective order,
    because the minifier splits statements.
- **Generated files never conflict.** They write disjoint private slots. Sublayer order matters only
  for hand-written rules that use public names.
- **The resolver stays low.** It lives in `lr-theme`, below every other layer that declares inputs,
  so any layered or unlayered application rule on the same element still wins, as in v21.

**Precedence for one public input on one element, highest first.** An element with no matching
declaration inherits.

1. Runtime inline values on that element (on `<html>`, or on a scope written by
   `applyLyraStyleScope()`), composed into one ownership-tracked set. The accent ramp wins over
   `overrides`, which win over the runtime look.
2. Unlayered application CSS.
3. `lr-overrides`, then `lr-utilities`.
4. Rules placed directly in `lr-theme-preset`, then its sublayers in this order: `.mode`, `.accent`,
   `.surface`, `.density`, `.look`.
5. `lr-theme` (`theme.css`).
6. `lr-base`.

Two consequences:

- A brand override written by the application beats a stylesheet-form accent where the override is
  declared, down to the next boundary. It loses to a runtime accent, which is inline.
- A hand-written look that sets mode-resolved or accent-owned inputs by their public names holds
  them only down to the next boundary. It neither follows nested mode islands nor yields to an
  accent on the same element. Composable application looks come from `lyraLookCss()` (see
  [Runtime API](#runtime-api)).

**Stylesheet files that load first.** If a hand-written look file loads before any Lyra stylesheet,
it creates `lr-theme-preset` below `lr-theme` unless it repeats both statements. The development
build detects this through the look's sentinel and warns.

### Runtime API

`@aceshooting/lyra-ui/theme.js` stays free of Lit, component and external runtime dependencies,
side-effect-free on import, and importable on the server. A small internal diagnostic helper shares
the development warning gate without importing attribute-checking or component machinery.

```ts
// New unless marked. LyraThemeTokens, LyraThemeAccentValue and LyraThemeSemanticRole are v21 types,
// reused unchanged.
export type LyraStyleAxis = 'look' | 'surface' | 'density' | 'mode' | 'accent';
export type LyraStyleField = LyraStyleAxis | 'accentBackground' | 'overrides';
export type LyraLookId = 'lyra' | 'shadcn' | (string & {});
export type LyraSurface = 'solid' | 'glass';
export type LyraDensity = 'compact' | 'comfortable' | 'touch';
export type LyraMode = 'light' | 'dark' | 'system' | 'unset';
export type LyraAccentName = 'emerald' | 'peridot' | 'topaz' | 'ruby' | 'tourmaline' | 'amethyst'
  | 'aquamarine' | 'sapphire' | 'hematite'; // literal copy; no gemstone catalog dependency
export type LyraAccent = LyraAccentName | (string & {})
  | { readonly [role in LyraThemeSemanticRole]?: LyraThemeAccentValue } | null;
export type LyraAccentBackground =
  | string | { readonly light?: string | null; readonly dark?: string | null } | null;

/** A look in runtime form: an id plus a validated token map. */
export interface LyraLook {
  readonly id: LyraLookId;
  readonly tokens: LyraThemeTokens;
}

/** The applied choices. Defaults are reported as values, never as null. */
export interface LyraStyle {
  readonly look: LyraLookId;               // 'lyra'
  readonly lookForm: 'stylesheet' | 'runtime';
  readonly surface: LyraSurface;           // 'solid'
  readonly density: LyraDensity;           // 'comfortable'
  readonly mode: LyraMode;                 // 'system'
  readonly accent: LyraAccent;             // null: the look's own
  readonly accentBackground: LyraAccentBackground; // null: the look's reference surfaces
  readonly overrides?: LyraThemeTokens;    // present only while applied
  readonly resolvedMode: 'light' | 'dark' | null; // derived, never persisted
}

/** Omitted field: keep. null: reset that field to its default. */
export interface LyraStyleChoices {
  look?: LyraLookId | LyraLook | null;     // a string selects the stylesheet form; a LyraLook the runtime form
  surface?: LyraSurface | null;
  density?: LyraDensity | null;
  mode?: LyraMode | null;
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens | null;
}

/** A scope's complete choices. Omitted field: inherit. */
export interface LyraStyleScopeChoices {
  look?: LyraLookId | LyraLook;
  surface?: LyraSurface;
  density?: LyraDensity;
  mode?: 'light' | 'dark' | 'system';
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens;
}

export interface LyraStyleChangeDetail {
  readonly style: Readonly<LyraStyle>;
  readonly changed: readonly (LyraStyleField | 'resolvedMode')[];
}

export function setLyraStyle(choices: LyraStyleChoices): Readonly<LyraStyle>;
export function getLyraStyle(): Readonly<LyraStyle>;
export function resetLyraStyle(fields?: readonly LyraStyleField[]): Readonly<LyraStyle>;
export function applyLyraStyleScope(element: Element, choices: LyraStyleScopeChoices | null): void;
export function defineLyraLook<const Look extends LyraLook>(look: Look): Readonly<Look>;
export function parseLyraStyleRecord(value: unknown): Readonly<LyraStyle>;
export function lyraStyleAttributes(style: Partial<LyraStyle>): Readonly<Record<string, string>>;

// Compatible names with extended behaviour: they now restore every axis.
export function createLyraThemeBootstrap(options?: LyraThemeBootstrapOptions): string;
export const lyraThemeBootstrap: string;

// @aceshooting/lyra-ui/theme/look-css.js (new subpath, so theme.js stays small)
export function lyraLookCss(look: LyraLook, options?: { readonly modeAliases?: boolean }): string;
```

**`setLyraStyle(choices)`**

- **Basic behaviour.** It merges `choices` into the stored state, persists it, applies it to
  `document.documentElement`, dispatches events, and returns the normalized snapshot. Like
  `setLyraTheme()`, it never throws.
  - Invalid fields fail closed to their defaults, one at a time.
  - If storage fails, it still applies without persisting, and later merges fall back to the last
    applied state.
- **Look id string (stylesheet form).** Only the id is persisted, `data-lr-look` is written, and any
  inline values left by an earlier runtime look are removed.
- **`LyraLook` object (runtime form).** The runtime:
  - persists the map;
  - writes `data-lr-look` with the look's id;
  - writes public inline values for the resolved mode, which keeps v21's precedence and keeps
    working on pages without `theme.css`;
  - writes per-mode slots, so mode islands, accent scopes and nested scopes keep the look.
- **Density, surface and named accents** are written as attributes only. Their stylesheets must be
  loaded; the development build warns when a sentinel shows one is missing.
- **Plain values** in a runtime look or in `overrides` apply in both modes. Every branch the runtime
  writes is floored against the references for its own mode, so no value that reaches an island has
  skipped the contrast check. A `{ light, dark }` pair with a `null` branch leaves that mode to the
  stylesheets, as in v21.
- **Overrides:**
  - may set only look-namespace inputs; surface inputs and private names are rejected;
  - are composed over the runtime look;
  - reach mode and accent islands;
  - are reset by nested look scopes.
- **Custom accents** are derived for both modes and written as accent slots, plus the ramp for the
  resolved mode as public inline values on `<html>`, as in v21.
  - The ramp is mixed against the first available of: `accentBackground`, the runtime look's own
    surface entries, or the embedded reference surfaces of the applied built-in look.
  - Its loud fill, also used as accent text, is floored to 4.5:1 against its quiet fill and every
    built-in look's reference surfaces. Borders and focus colour meet 3:1 against those surfaces;
    on-colours are selected against their corresponding fills. This can darken a light-mode accent
    and change its on-loud partner from black to white compared with v21.
  - An application's stylesheet look is not known to the runtime. For such a look, pass
    `accentBackground` or use its runtime form. This is a documented limit.
- **Operating-system mode flips** rewrite only the root's public values, from pairs that were already
  floored. There is no derivation and no canvas work.

**`getLyraStyle()`** re-reads storage on every call. When storage is unusable, it reports what the
document is actually showing, exactly as `getLyraTheme()` does.

**`resetLyraStyle(fields?)`** resets the listed fields, or every field when called with no argument.
It is equivalent to `setLyraStyle()` with `null` for each field.

**`applyLyraStyleScope(element, choices)`**

- It *replaces* the element's scope state rather than merging into it. `null` removes every
  Lyra-owned attribute and inline value from the element.
- **Attributes:** it writes the axis attributes. An explicit mode gets `data-lr-mode` plus the
  resolved `data-lr-theme`. `system` scopes are kept current by one shared media-query listener over
  weakly held elements.
- **Inline values:** runtime-form values are written as slots plus public mode-independent inputs, and
  ownership is recorded on the element.
- **Scope marker:** it always writes RFC 0002's scope marker when it writes inline inputs.
- **Requirements:** `theme.css` (the resolver) must apply in the element's tree scope, and
  stylesheet-form values need their stylesheets there too.
- **Accents in a scope** are derived against that scope's look.
- **No persistence and no events.** Canvas components still repaint, because they observe the
  attributes.
- **Other documents:** it accepts another document's root, which is how a popup window or an iframe
  mirrors the page.

**`defineLyraLook(look)`** validates and deep-freezes a runtime look. It throws `TypeError` exactly
where the runtime would drop something:

- an invalid or reserved id;
- a grammar violation;
- a name owned by another axis, or `--lr-theme-accent`;
- a forbidden reference, as defined by the rules above;
- more than 512 entries.

It also stamps the id on the frozen map under a private symbol, which is how the facade recognizes a
spread of a built-in map.

This does not register the id or install a stylesheet. Apply the returned object for runtime form,
or load `lyraLookCss()` output before selecting its id. A string such as `look: 'shadcn'` requires
`looks/shadcn.css`; the surface and density selections likewise require their optional stylesheets.

**`lyraLookCss(look, options)`** is DOM-free.

- **Output:** it returns the stylesheet form of a look with both layer statements, the look's slots
  and public inputs under `[data-lr-look='<id>']`, and its follow switches. With
  `{ modeAliases: true }` it also emits `.light` and `.dark` aliases, with a copy of the resolver for
  those classes inside the look's scope. This is how an application stylesheet look takes part in
  nested modes and accents without public slot names.
- **Version binding:** the output is tied to the library version, because private names may change in
  any release. It carries a sentinel, and the development build warns when the sentinel does not
  match. Applications regenerate the file in their build.
- **No contrast floor:** it floors nothing, because flooring needs a canvas. Application stylesheet
  looks carry their own contrast responsibility; runtime looks get the floor.

**`parseLyraStyleRecord(value)`** is DOM-free and safe on the server. It normalizes a parsed v1 or v2
record, and checks colour fields syntactically. The browser runtime re-validates them.

**`lyraStyleAttributes(style)`** is DOM-free.

- It returns the requested-axis attributes a server renders on `<html>`, for example
  `{ 'data-lr-look': 'shadcn', 'data-lr-surface': 'glass', 'data-lr-density': 'compact',
  'data-lr-mode': 'system', 'data-lr-accent': 'sapphire' }`.
- It never returns `data-lr-theme` or `data-theme`, so the runtime stays their only writer on
  `<html>`.
- `unset` produces no mode attribute. A custom accent colour produces `data-lr-accent="custom"`.

**Events**

- **`lr-style-change`** is new. It is dispatched on `window` and typed through `WindowEventMap`. It
  is a notification and never cancelable.
- **When it fires:** after every `setLyraStyle()` or `resetLyraStyle()` call, and after an
  operating-system change of the resolved mode (with `changed: ['resolvedMode']`).
- **Compatibility while the facade is supported:** the same occasions also dispatch `lr-theme-change` with the v21
  snapshot shape, so v21 listeners and mixed-version pages keep working. `lr-theme-preset-change`
  fires only through the deprecated preset API.
- **No component changes:** no component event changes, so `events.ts` and the framework type maps
  are unaffected.

### Persisted record

The storage key stays `lyra-theme`, so `createLyraThemeBootstrap({ storageKey })` and the static
asset's `data-lr-theme-storage-key` keep working. Version 2 keeps every v1 field with its v1 meaning
and adds fields whose names do not collide:

| Field | Meaning | In v1 |
| --- | --- | --- |
| `version` | `2` | absent |
| `mode` | `light`, `dark`, `system` or `unset`. v21 reads `system` as `auto`. | yes |
| `look` | look id | absent |
| `tokens` | the runtime-form look's map (the v1 meaning: an inline map, "a token map is a look") | yes |
| `overrides` | override map | absent |
| `density`, `treatment` | density and the surface axis (`solid` or `glass`) | absent |
| `accentName` | named accent id, when one is chosen | absent |
| `accent` | CSS colour or per-role record (v1 meaning). A named accent also stores its gemstone colour here. | yes |
| `surface` | the accent mix base (v1 meaning; `accentBackground` in the API) | yes |

- **Reading a v1 record.** The runtime and the bootstrap both migrate a record that has no `version`:
  - `auto` becomes `system`;
  - `tokens` becomes a runtime-form look with id `custom`;
  - `accent` and `surface` are kept as colours, so a v1 `'aquamarine'` stays the CSS colour.

  The rendering is identical. Because the map becomes a look rather than an override, a later
  `setLyraStyle({ look: 'material' })` replaces it. The next write stores version 2. Version 1
  records remain readable throughout the v23 line.
- **Reading a version 2 record with v21 code.** The mode, the accent (as its colour), the surface
  and `tokens` render as before. The stylesheet look, density, treatment and `overrides` are
  ignored. A v21 write then erases the version-2-only fields, and the next v22 read migrates the
  record as version 1.
- **Stale snapshots.** `tokens` is a snapshot, because it is needed for pre-paint restoration. An
  application that ships an updated definition re-applies it at startup when `getLyraStyle().look`
  matches the id. The call changes nothing when the snapshot is already equal.
- **Cookies.** A server that mirrors the record into a cookie keeps only the axis fields: `mode`,
  `look` in stylesheet form, `density`, `treatment` and `accentName`. `tokens` and `overrides` exceed
  cookie limits, and the bootstrap restores them.

### Stylesheet artifacts

| Subpath | Contents | Layer | Status |
| --- | --- | --- | --- |
| `theme.css` | The Lyra look as slots on `:root, [data-lr-look]`; the resolver; the accent reset; the mode rules, including `system` | `lr-theme`; `lr-theme-preset.mode` | compatible rendering (see behaviour changes); internals rewritten |
| `looks/shadcn.css` | The shadcn delta and its follow switch on `[data-lr-look='shadcn']`; `.light` and `.dark` aliases inside that scope | `.look`; `.mode` | new |
| `looks/<material-id>.css` | The Material-inspired look (item 3) | `.look` | new |
| `density.css` | `[data-lr-density='compact' \| 'comfortable' \| 'touch']` | `.density` | new (item 5) |
| `surfaces/glass.css` | `[data-lr-surface='glass' \| 'solid']` | `.surface` | new (item 4) |
| `accents.css` | The nine named accents as accent slots | `.accent` | new |
| `themes/shadcn.css` | Fixed form. It applies on import, answers to `.light` and `.dark` anywhere with its own resolver copy for those classes, and is generated from the same definition. | `.look`; `.mode` | deprecated |

- **Dependencies.** Every axis stylesheet requires `theme.css`. Each one declares a private sentinel,
  which the development build checks.
- **Mode aliases.** The shadcn aliases live in the generated `theme.css` boundary list only in the
  scoped form `[data-lr-look='shadcn'] :is(.light, .dark)`. So an unrelated `.dark` class outside a
  shadcn scope does nothing, which the prototype confirmed.
- **Scope list.** RFC 0002's scope list includes that selector and every axis attribute. That answers
  its open question 3 for the switchable look. The deprecated fixed form still needs bare `.light` and
  `.dark` as scopes through v23, with removal no earlier than v24.

### Runtime modules

| Subpath | Exports | Status |
| --- | --- | --- |
| `theme.js` | The API above, plus the deprecated facade (see [Compatibility](#compatibility-and-migration)) | compatible, extended |
| `theme/look-css.js` | `lyraLookCss` | new |
| `theme/looks/shadcn.js` | `LYRA_SHADCN_LOOK` | new |
| `theme/looks/<material-id>.js` | The Material-inspired `LyraLook` (item 3) | new |
| `theme/presets.js` | `defineLyraThemePreset`, `applyLyraThemePreset`, `LYRA_THEME_PRESETS` | deprecated |
| `theme/presets/shadcn.js` | `LYRA_SHADCN_THEME_PRESET` | deprecated |
| `theme-bootstrap.js` | The bootstrap asset, now restoring every axis | compatible, extended |

### Authored definitions and generation

Every look, density preset, surface treatment and named accent is authored once, as data:

- **Lyra look:** projected from the theme-input entries of `tokens/canonical-tokens.json`, which stays
  the only source of Lyra's values.
- **Other looks:** `tokens/looks/<id>.json`, in the existing `LyraThemeTokens` shape.
- **Density and glass:** `tokens/density.json` and `tokens/surfaces/glass.json`.
- **Named accents:** each gemstone colour goes through the runtime's own derivation against every
  built-in look's reference surfaces. The result is floored against all of them, giving one ramp per
  accent per mode. `theme.js` and the bootstrap carry literal copies of the names, the colours and
  the built-in looks' reference surfaces, and a drift test guards them, as it does for the grammar.

Generators produce the following, and `--check` keeps each fresh inside `contract-policy`:

- the switchable stylesheets;
- the fixed `themes/shadcn.css`;
- the runtime modules;
- per-look entries in `design-tokens.json`, under `com.aceshooting.lyra.looks`;
- editor data;
- Storybook preview data;
- the reference tables in `llms/shared.md`.

The flow of `themes/shadcn.css` is reversed: v21 builds the runtime preset from the CSS, while v22
builds both forms from JSON. The token grammar validates every value, and `check:style-axes` adds
these rules:

- **Namespaces.** Looks own role ramps through look slots, and accents own them through accent slots.
  Density and mode are private. Surface inputs are written only by the surface axis. No definition
  writes `color-scheme` or a private name.
- **References** follow the rules in [Resolution model](#resolution-model).
- **Complete pairs.** Built-in looks carry a complete pair for every mode-resolved input they set.
- **Forced colours.**
  - Control border widths are greater than 0; a transparent colour is fine.
  - The focus ring is at least 2px wide.

  Both rules exist because forced colours strip fills and shadows.
- **Chart palettes.** Each look's categorical chart palette passes the existing chart criteria
  (item 8).
- **Accent ramps** are floored against every built-in look.
- **Layer statements.** Both appear in every Lyra stylesheet.
- **Mode set.** The mode-resolved set contains all of v21's dark-rule inputs, and any addition is
  listed as a behaviour change.

### Pre-paint bootstrap and server rendering

The bootstrap reads a v1 or version 2 record.

- **Attributes.** Before any stylesheet, it writes `data-lr-mode`, the resolved `data-lr-theme` and
  `data-theme`, `data-lr-look`, `data-lr-density`, `data-lr-surface` and `data-lr-accent`. So
  stylesheet-form looks, density, glass and named accents apply at first paint, with no layout shift.
- **Inline values.** It restores runtime-look tokens, `overrides` and custom accents, both as per-mode
  slots and as public values for the resolved mode. It uses the v21 pipeline: grammar, per-mode
  floor, ownership list.
- **`data-lr-theme-attributes`** still configures the resolved-mode attribute list.

With a server:

- The server calls `lyraStyleAttributes(parseLyraStyleRecord(cookieValue))` and renders the result on
  `<html>`.
- With no script at all, stylesheet looks, named accents, density, surface and all three modes
  (including `system`) render correctly.
- Runtime looks and custom colours need colour parsing that exists only in the browser. They appear
  when the bootstrap runs, which is still before first paint.

## Composition and interaction

**How components consume the axes.** No new element is proposed.

- **Look, mode and accent** reach components through the inputs they already read.
- **Density** reaches components through 13 scaled inputs: the six spacing steps, the six
  form-control heights and `--lr-theme-icon-button-size`. Item 2's row-height input joins them. No
  component token sheet changes.
  - `--lr-icon-button-size-scope` is an explicit subtree value and is not scaled.
  - The per-host coarse-pointer floor still applies, and it stays on the host under RFC 0002.
  - Components whose spacing comes from value-named size tokens do not scale. Item 5 moves the
    covered families (tables, forms, navigation and toolbars) onto scaled inputs.
- **Surface** is honoured only by navigation, toolbar, menu, popover, toast and media-control
  components, through one shared mixin beside `overlay-surface.styles.ts`. Examples are
  `lr-app-rail`, `lr-navigation-menu`, `lr-menubar`, `lr-menu`, `lr-context-menu`, surfaces built on
  `lr-popup`, `lr-selection-toolbar`, `lr-toast`, and the controls owned by `lr-av-player`. Item 4
  fixes the exact list. Content surfaces never become glass.

**Glass mechanics (the contract for item 4).**

- **Solid stays identical.** The mixin keeps the v21 declaration as the fallback arm of a private
  switch, so the solid treatment renders byte-identically.
- **Glass values.** Glass computes its fill with `color-mix()` at `--lr-theme-surface-opacity`,
  clamped from below to the minimum that the contrast gate validated. Its blur is clamped from above
  to a maximum radius that item 4 sets. Application CSS therefore cannot push glass below the
  contrast bound or past the cost bound.
- **Fallbacks.** `solid`, reduced transparency, forced colours, increased contrast and missing
  `backdrop-filter` support each turn the switch off. Under forced colours, the surface paints
  `Canvas`.
- **`backdrop-filter`.** The mixin emits both the `-webkit-` prefixed and the standard property. A
  solid surface resolves to `none`, never `blur(0)`, because any other value creates a containing
  block and a stacking context.
- **Nesting guard.** A glass surface turns glass off for its own descendants in the flat tree, so a
  menu opened from a glass toolbar is solid.
- **Clear variant.** The clear variant is a component option on `lr-av-player`'s own control bar, not
  an axis value.
  - It is allowed only where the player draws its own gradient scrim beneath the controls.
  - The contrast gate composites that scrim and the fill together, over black and over white.

**Density mechanics (the contract for item 5).**

- **Factors.** Density factors multiply the look's own base geometry, so `shadcn` plus `compact`
  compacts shadcn's heights, not Lyra's.
- **`comfortable`** is factor 1 with no floor. That is v21 exactly, and it keeps the default path
  free of `calc()`.
- **`compact`** floors control inputs at 24px. WCAG 2.5.8 is measured on rendered boxes at `compact`
  itself. Every target is at least 24×24 CSS pixels, or passes the spacing exception evaluated at
  `compact`, never inherited from `comfortable`.
- **`touch`** floors control inputs at `max(44px, 2.75rem)`. Every pointer target is at least 44×44,
  except inline text links and targets the user agent owns.
- **`compact` properties.** A component's own `compact` property keeps its v21 meaning and composes
  with density. The rendered-box tests run with that property set, and the coarse-pointer floor
  applies regardless of it. Item 25 folds `compact` into size and density.

**Length reads from JavaScript.** Under `compact` and `touch`, a scaled input computes to
`max(calc(…))` text, which the regex-based `resolveCssLength()` cannot parse. So every internal read
of a scaled token moves to a computed-length probe: a private element whose length property is set
to the token, read after style resolution, the same approach as `resolveCanvasColor()`. Current
reads include:

- the placement gap of `lr-selection-toolbar`, read from `--lr-space-s`;
- the target size of `lr-heatmap` and `lr-flow-minimap`, and the selection-column reservation of
  `lr-data-grid`, read from `--lr-icon-button-size`;
- token-based table resize limits, data-grid dimensions, command-palette row/group pitches,
  flow-canvas fallback geometry, mind-map ring gaps and graph edge-label font sizes.

Stage 3 inventories every such read, including reads outside `resolveCssLength()` callers. The
internal `resolveCssTokenLength()` preserves the literal fast path and resolves CSS math in a live
owner-document probe; the public `resolveCssLength()` keeps its literal-only contract. On the
default path, computed inputs remain plain lengths. Verify both initial measurement and live
axis changes, especially cached geometry in virtualized and canvas-based components.

**States, focus, keyboard and pointer** are unaffected. Axes change no DOM, focus order, keyboard
handling, event or ARIA. Rendered-DOM equality tests across axis combinations prove this, including
server-rendered output.

**Motion.** An axis switch runs components' existing colour transitions, as a v21 mode switch does:
`lr-button`'s background fades over the 120 ms fast duration. Under reduced motion the switch is
instant (open question 11).

**Observers.** These watch theme attributes, and each gains `data-lr-mode`, `data-lr-look`,
`data-lr-density`, `data-lr-surface` and `data-lr-accent`:

- `ThemeWatcher` (`internal/theme-watcher.ts`), used by the chart, heatmap, map, QR-code, word-cloud,
  audio-visualizer, media-player and e-book components;
- `watchDarkTheme` (the code-block and markdown syntax themes), including `data-lr-theme` and
  flattened ancestry through slots and shadow hosts;
- `lr-zoomable-frame`'s theme sync. It filters only `data-lr-theme` and copies only `--lr-theme-*`,
  so it is rebuilt on `applyLyraStyleScope()` for the frame's document.

A test asserts that every observer's filter covers the axis attributes.

**Surfaces appended to `document.body`.** Toast regions and `confirm()` dialogs are appended to
`document.body`. They follow the document's axes, not the scope of the element that raised them.
This is documented (open question 13).

**Tree scopes.**

- Inheritance crosses shadow boundaries, so a scope outside a shadow root reaches everything inside
  it.
- Selectors do not cross shadow boundaries. So an axis *attribute* placed inside an application
  shadow root needs the resolver and the chosen stylesheets in that tree scope, just as a v21
  `.lr-dark` island does. Attributes in Lyra's own component templates never occur.
- RFC 0002's adoption points are an optional delivery route (open question 12). Stage 1 must also
  document and test explicit stylesheet adoption in application roots without the document token
  optimization: its performance gate may defer independently of the style axes. Inherited styling
  alone does not prove that an axis attribute inside a foreign root works.

**Loading, empty and error handling.**

- A missing look stylesheet leaves the Lyra base at that look boundary, because `theme.css`
  declares that base on every `[data-lr-look]`. The development build warns; it must not report the
  requested look as visually installed. Missing surface/density/accent styles leave their inherited
  treatment in effect.
- An unknown look id likewise creates a Lyra look boundary, rather than inheriting the parent look.
  Other unknown axis values have no value-specific rule and leave the inherited choice in effect.
- An invalid runtime value fails closed to that field's default.

**Pickers.** Applications compose existing elements:

- `lr-segmented` for mode, density and surface;
- `lr-select` for the look;
- `lr-swatch-picker` with `GEMSTONES` for named accents;
- `lr-color-picker` for a custom accent.

The gallery (item 6) uses the same pieces. Labels belong to the application's localization catalog.

**Narrow allocation.** Axes add no layout of their own. Container-query behaviour is unchanged, and
the narrow-allocation tests also run in `compact` and `touch`.

## Accessibility, localization, and RTL

- **Semantics, names, stateful ARIA, focus return and live regions:** not applicable. There is no new
  element, and axes never alter these. The runtime announces nothing, and a picker built by an
  application owns its own announcements.
- **Contrast.** The static gate covers every built-in look × named accent (including no accent)
  × mode × surface, including hover, press, selected and focus states. Testing accent and glass
  separately does not prove their composition. Browser fixtures also combine custom accents and
  glass with the solid fallbacks.
  - **Glass:** text and on-colours must reach 4.5:1, and control boundaries and focus rings 3:1,
    against the composited surface. That surface is the fill at the clamped minimum opacity,
    including the highlight layer and any translucent border, composited over black and over white.
    The two results must fall on the same side of the foreground's luminance, and the nearer one must
    reach the ratio. Because compositing is monotonic in each channel, this bounds every possible
    backdrop.
  - **Runtime looks and overrides** keep the v21 token-map floor, now applied per written mode.
    **Custom accents** also floor their loud fill as text to 4.5:1 against quiet and built-in
    reference surfaces, with a matching on-loud foreground.
  - **Browser tests** add islands × plain values and nested looks × inherited custom accents.
- **Target size.** The density invariants above apply. `check:hit-area` keeps checking the
  comfortable source, and rendered-box tests cover every built-in look × `compact` and `touch`.
- **Zoom and text spacing.** Automated checks cover the compact controls and tables at 200% root text
  size and with WCAG 1.4.12 text spacing, with no clipping, in all three engines.
- **Forced colours.**
  - Glass is off and paints system colours.
  - The `check:style-axes` border and focus-ring rules keep control boundaries visible in every
    look.
  - Each built-in look has forced-colours tests, and density still applies.
  - The prototype matched v21 under forced colours in Chromium, in both operating-system schemes.
- **Reduced motion.** See [Motion](#composition-and-interaction). Glass has no motion of its own.
- **Reduced transparency and increased contrast.** Glass is solid under
  `prefers-reduced-transparency: reduce` where the engine exposes it, and solid with a control
  boundary under `prefers-contrast: more`.
  - The reduced-transparency query is not exposed in every engine. Support is re-checked against
    compatibility data when item 4 lands, with Safari recorded as pending evidence, because Apple
    platforms are where glass is most expected.
  - So an application that enables glass must also offer the user a `solid` choice. This is a
    documented requirement.
  - Automated coverage emulates the query only in Chromium, through the DevTools protocol. Other
    engines are pending evidence.
- **Localization.** The runtime has no user-facing strings. Development warnings are English console
  output. Look and accent ids are identifiers, not labels, and the gallery localizes its labels
  through `DEFAULT_STRINGS` keys.
- **RTL.** Axes are direction-agnostic. The glass edge highlight and all density-scaled padding use
  logical properties, and every scope test also runs under `dir="rtl"`.
- **Pending human evidence.**
  - Glass legibility over varied live backgrounds, in both modes, at 200% zoom, with long labels and
    nested surfaces.
  - Visual review of every built-in look × density × surface on representative desktop and mobile
    hardware.
  - Windows High Contrast review of each built-in look.

  No cross-browser visual-parity claim is made before these are done.

## Platform, security, and packaging

### SSR and hydration

- **Server import.** `theme.js` and `theme/look-css.js` are side-effect-free and importable on the
  server.
- **Where axis attributes live.** Only on `<html>` and on elements the application authors, never
  inside component templates. Components never render differently per axis.
- **No hydration mismatch in Lyra components**, and `diagnoseLyraHydration()` results are unchanged.
  On an `<html>` element that a framework owns, the runtime writes only `data-lr-theme` and
  `data-theme`, and rewrites requested-axis attributes only with the same stored choices. As today,
  such frameworks suppress hydration warnings for those attributes on `<html>`.
- **Declarative shadow DOM** inherits the inputs like any other shadow root.
- **`system`** resolves in CSS before any script runs.
- **Document adoption.** A component moved into another document inherits that document's axes. The
  existing `adoptedCallback` and per-realm watcher repaint canvases, and `applyLyraStyleScope()` on
  the other document's root mirrors the page's choices.

### Browser support

**No floor change.** The mechanism uses:

- custom properties with nested `var()` fallbacks and empty values;
- nested `@layer` names (Chrome 99, Firefox 97, Safari 15.4);
- `color-mix()`, which is already on the floor.

All of these are below the current floor (Chrome 120, Firefox 121, Safari 16.4). Following
`docs/support-policy.md`, the floor is derived from compatibility data, not from the prototype,
which ran only current engines.

**Glass.** `backdrop-filter` needs the `-webkit-` prefix below Safari 18, and the mixin emits both.
`prefers-reduced-transparency` is handled as above.

**Not used:** `light-dark()` (see [Alternatives](#alternatives-considered)), `@scope`, container
style queries and CSS `if()`. The last two could later replace the private switches.

### Security

- **Values.** Every token value, whether in a look, `tokens` or `overrides`, passes the existing
  DOM-free grammar. `url()`, `image-set()`, `attr()` and `env()` stay banned. Glass filters are
  composed by Lyra's mixin from numeric inputs, so the grammar gains no filter functions.
- **Attributes.** Attribute values the runtime writes come from closed sets or the kebab-case id
  rule, never from raw input. Stored records are normalized field by field and fail closed.
- **Style policies.** Stylesheet-form choices need no inline style, which suits the strictest style
  policies. Runtime-form values use CSSOM `setProperty()`. The prototype confirmed that it writes an
  empty switch value correctly in all three engines.
- **Hash-pinned deployments.** The bootstrap's bytes change, so deployments that pin its hash must
  regenerate it.
- **No remote content and no optional peers** are involved.

### Clean-room provenance

- **The shadcn look** is carried over from v21's `themes/shadcn.css`. It reproduces the published,
  MIT-licensed shadcn/ui "new-york" style on the Neutral base colour and Tailwind CSS's published
  shadow scale. It keeps that stylesheet's documented deviations for contrast: the control borders,
  the focus colour, the danger shades, the chart ramp and the hover mix partner. Its purpose is
  compatibility with that published theme, so its values are the published ones.
- **New looks and treatments** are original Lyra definitions: the Material-inspired look, the later
  looks, glass and density. They are derived from public design principles:
  - the Material 3 documentation on colour roles, shape scales, elevation and state layers;
  - Apple's Human Interface Guidelines on materials;
  - Fluent's material guidance;
  - the public theming documentation of Vaadin, Web Awesome and shadcn/ui.

  No upstream source, stylesheet, token value, prose or asset is copied into them. Each authored
  look records the public pages it consulted, and review checks value provenance before acceptance.

### Side effects, tree shaking and new dependencies

- JavaScript modules stay side-effect-free.
- Every new CSS asset joins both forms of `package.json#sideEffects` and the explicit exports.
- Runtime looks and `lyraLookCss` live in their own subpaths, so an application pays only for what it
  imports.
- There are no new dependencies.

### Performance and bundle cost

**Switch cost.** The prototype renders 1,000 mixed components (`lr-button`, `lr-input`, `lr-card`,
`lr-badge`, `lr-icon`, `lr-switch`) with the built package. It times one attribute or style change
on `<html>` followed by a forced style and layout flush. Each figure is the median of 96 samples, with
the interquartile range in brackets. The samples come from four runs of 24 timed switches, with the
variant order alternating between runs. The machine was shared, with a load average of about 20, so
treat differences inside overlapping ranges as noise.

| Engine | v21 mode switch | This RFC: mode switch | `light-dark()`: mode switch | v21: runtime shadcn preset (124 inline writes) | This RFC: `data-lr-look` switch | This RFC: `data-lr-accent` switch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | 46.2 ms [33.9–53.0] | 47.0 [33.7–51.6] | 49.0 [33.7–53.3] | 70.7 [55.6–79.1] | 67.3 [54.4–77.0] | 52.4 [35.9–54.9] |
| Firefox | 41.2 [38.8–45.7] | 39.4 [37.7–42.5] | 43.2 [39.7–49.9] | 74.7 [71.7–77.3] | 74.4 [70.7–77.6] | 39.3 [37.0–45.8] |
| WebKit | 113.9 [107.6–124.2] | 118.1 [108.4–136.3] | 166.6 [143.5–191.9] | 149.4 [142.9–161.0] | 161.4 [154.9–173.3] | 112.0 [105.5–121.6] |

**Reading the table.**

- **Mode switches** measure +2% against v21 in Chromium, −4% in Firefox and +4% in WebKit.
- **Look switches.** A look switch changes font sizes and control heights, so it re-lays out the page.
  Its v21 equivalent is the runtime preset, and against that it measures −5% in Chromium, 0% in
  Firefox and +8% in WebKit.
- **Earlier run.** A run of the prototype's first form, before the island-parity refinements, gave
  the same picture: mode switches within +4% of v21 everywhere, and `light-dark()` 14% slower in
  WebKit.
- **What a switch writes.** A stylesheet-form switch is one attribute write, with no inline writes and
  no canvas work. An operating-system flip with a runtime look rewrites the root's public values from
  pairs that were already floored.

**Acceptance.** In each engine, a switch may cost at most 10% more than its v21 equivalent:

- a mode switch, against v21's mode switch;
- a look switch, against v21's runtime preset for the same look;
- an accent switch, against v21's runtime accent.

It is measured in CI-like isolation, at 1,000 and 3,000 elements, and with 50 nested scopes present.
WebKit's look switch, at +8% on a loaded machine, is the case to watch.

**Per-element cost.**

- Components gain no declarations. The 293 unconditional per-host declarations that RFC 0002
  measures are unchanged by this RFC.
- Each element that carries an axis attribute resolves at most 125 inputs (112 mode-resolved and 13
  density-scaled), so the cost grows with the number of scopes, not the number of components.
- Under RFC 0002, every axis boundary is also a theme scope.

**Glass.** `backdrop-filter` is composited in every frame in which content moves behind the surface,
and its cost grows with the blurred area and radius. It is limited to small navigation and transient
surfaces, the blur is clamped, the nesting guard prevents stacking, and nothing is pointer-driven.
Scroll and animation frame times are recorded on representative hardware before glass is called
done.

**Bytes.** These are gzip level 9 sizes, measured with the same minification that reproduces the
shipped `theme.css` size exactly.

| Artifact | v21 | v22 |
| --- | ---: | ---: |
| `theme.css` | 2,919 B | 5,472 B, prototype (+2,553 B: slots, resolver, accent reset, follow and density switches) |
| `themes/shadcn.css` → `looks/shadcn.css` | 1,986 B | 958 B, prototype (delta only) |
| `accents.css` (nine accents) | — | ≈1.4 KB, prototype with ramps of the same shape |
| `density.css`, `surfaces/glass.css` | — | each expected under 0.5 KB; measured by items 5 and 4 |
| `theme/theme.js` | budget 6.24 KiB (bundled, minified) | +≈2 KB expected for axes, scopes, record migration and the facade. The facade remains through v23. Measured in stage 1. |
| Bootstrap string and `theme-bootstrap.js` | 3,980 B reviewed; 4,060 B ceiling | measured by a prototype before stage 1 merges (see below) |
| Per component | — | 0 for density; up to ≈0.4 KB for the glass mixin, only in surface-honouring components |

For a Lyra-look page the net cost is about +2.5 KB of CSS; for a shadcn page it is about +1.5 KB. The
`theme/presets/shadcn.js` runtime preset (≈1.9 KB) is replaced by `theme/looks/shadcn.js` at a
similar size. Budgets are updated from reviewed measurements, following the existing rule for raising
a ceiling.

## Compatibility and migration

This is a **major** change. Compatibility excludes only the behaviour changes listed below.
Default-state parity qualification compares every registered component in a 600px-wide allocation,
in light and dark roots and mode islands, under both operating-system schemes, against the published
v21 package. That fixture does not establish parity at every allocation or in populated and open
states; those require separate qualification. The component corrections in items 6–9 are explicit
exceptions, not permission for other default-rendering changes.

| Surface | v22 | v23 |
| --- | --- | --- |
| `--lr-theme-*` inputs, `--lr-*` outputs, `--lr-theme-accent`, `tokens-root.css`, `design-tokens.css`, `invalidateLyraTheme()` | compatible | kept |
| `data-lr-theme`, `.lr-light`, `.lr-dark`, and `data-theme` written by the runtime | compatible (resolved mode) | kept (open question 5 covers `data-theme`) |
| `data-lr-mode`, `data-lr-look`, `data-lr-surface`, `data-lr-density`, `data-lr-accent` | new | kept |
| The five-name layer statement | compatible; sublayers nest inside `lr-theme-preset` | kept |
| `lyraThemeBootstrap`, `createLyraThemeBootstrap()`, `theme-bootstrap.js`, and the bootstrap's script attributes | compatible; they restore every axis, and their bytes change | kept |
| `LyraThemeTokens`, `LyraThemeTokenName`, `LyraThemeTokenValue`, `LyraThemeAccent`, `LyraThemeAccentValue`, `LyraThemeSemanticRole` | compatible, reused | kept |
| `setLyraTheme()`, `getLyraTheme()`, `LyraTheme`, `LyraThemeMode`, `LyraThemeChangeDetail`, `lr-theme-change` | deprecated facade with v21 semantics | kept |
| `defineLyraThemePreset()`, `applyLyraThemePreset()`, `LYRA_THEME_PRESETS`, the `LyraThemePreset*` types, `lr-theme-preset-change`, `data-lr-theme-preset` | deprecated | kept |
| `LYRA_SHADCN_THEME_PRESET`, `theme/presets/shadcn.js` | deprecated; keeps its v21 map, stamped with the id `shadcn` | kept |
| `themes/shadcn.css` | deprecated fixed form, generated | kept |
| Version 1 storage record | read and migrated | still read; revisit after v23 |

**The facade** maps v21 calls onto the same state.

- **Field mapping.**
  - `auto` maps to `system`, and `surface` to `accentBackground`.
  - `tokens` maps to a runtime-form look. Its id is the one stamped on a frozen map, and re-validation
    preserves the stamp. So both `LYRA_SHADCN_THEME_PRESET` and the documented `shadcn-exact` spread
    map to `shadcn`. Any other map becomes `custom`.
  - `tokens: null` resets the look to `lyra`.
- **Built-in presets.**
  - `system`, `light`, `dark` and `unset` map to `{ mode, accent: null }`.
  - Each gemstone preset still maps to `{ mode: 'system', accent: GEMSTONES[key].fill }`, rather
    than the named accent. Its runtime ramp now uses the per-mode, cross-look contrast floors,
    so its rendered loud fill and on-loud foreground can differ from v21.
- **Reading state.** `getLyraTheme()` returns the v21 shape. Its `tokens` is the runtime look's map
  merged with `overrides`.
- **Events.** The preset marker and its event keep their v21 occasions.
- **A known difference.** v21 code that calls `setLyraTheme({ tokens })` on a page that uses the new
  attribute-driven `looks/shadcn.css` replaces that look, because a token map is a look. With the
  fixed `themes/shadcn.css`, the map overlays the look, as in v21.

**Behaviour changes a v21 application can observe.** Items 1 and 2 are breaking. The rest are visible
but compatible.

1. Under `compact` and `touch` only, JavaScript reads of the 13 scaled inputs return `max(calc(…))`
   text. Lyra's own reads move to the length probe. Applications should read a rendered length
   instead.
2. Two changes to what reaches a mode island:
   - An unlayered `:root` override of `--lr-theme-color-surface-border-subtle` no longer reaches mode
     islands. That is the one input that a built-in look makes mode-dependent and that v21's dark
     rule did not re-declare. Write the override per mode.
   - A `var()` inside a look's value resolves on the look element and is inherited from there. v21
     islands re-resolved it on the island. That matters only for an application that sets
     `--lr-theme-shadow-color` between the root and an island.
3. Runtime looks, `overrides` and custom accent ramps now reach mode, look and accent islands, where
   v21 dropped them. Plain values apply in both modes and are floored per mode.
4. `lr-theme-change` also fires for calls to the new API. This is additive.
5. A version 2 record read by v21 code loses the stylesheet look, density, surface and `overrides`,
   and renders a named accent by deriving it from its gemstone colour.
6. `lr-button-group` sizes to its content at every allocation instead of filling a narrow
   allocation or reserving an artificial intrinsic width. An explicit host width remains respected.
   Applications that need the internal row to fill it can set
   `lr-button-group::part(base) { inline-size: 100%; }`.
7. The attachment menu inside `lr-prompt-input` follows its explicit surrounding light/dark mode.
   In WebKit, v21 could instead use operating-system colors when that scheme disagreed with the
   surrounding mode. This corrects mode inheritance; applications should not depend on that mismatch.
8. `lr-menu` bounds its minimum width by its containing allocation and viewport; positioned submenus
   also respect the positioner's available width. Previously the minimum could override those safety
   bounds and overflow narrow allocations, including at enlarged text sizes. The requested minimum
   remains effective when sufficient space is available.
9. The default Lyra dark control boundary (`--lr-theme-color-surface-border` and its shared fallback)
   changes from `#6b6b74` to `#787881`, meeting 3:1 on the dark overlay `#2b3038` (3.034:1). The old
   boundary fell below 3:1 on raised and overlay surfaces. Light boundaries, other looks and semantic
   palettes are unchanged. Chromatic plain-button hover/press text also moves toward body text, and
   selected tree rows use on-quiet text during hover/press, preserving 4.5:1 as their fills change;
   resting text and explicit component foreground overrides retain their behavior. Step numbers and
   interactive context-meter legend rows use matching semantic fill/on-color pairs instead of
   treating a control-border color as a text background. The opt-in Material look defines 8% hover
   and 12% press state layers with its `currentColor` partner to retain filled-action contrast.
10. Runtime custom accents, including legacy gemstone presets and `setLyraTheme({ accent })`,
    floor the loud fill to 4.5:1 against the quiet fill and built-in reference surfaces because that
    token also paints accent text. The on-loud foreground is selected for the corrected fill. For
    example, the light shadcn emerald story changes from `#34d399` with black on-loud text to
    `#1a6a4d` with white on-loud text; the new fill and white text have 6.537:1 contrast. The same
    loud token changes checked controls, brand text and streaming accents; secondary neutral
    controls remain unchanged. The supplied accent value and persisted color are preserved.

**Automated migration.** The `--origin=lyra-v21` profile of
[RFC 0003](0003-lyra-v21-migration-profile.md) only reports these changes; it does not rewrite them.
It reports:

- every `setLyraTheme`, `getLyraTheme`, `applyLyraThemePreset` and `defineLyraThemePreset` call, with
  the equivalent `setLyraStyle` call;
- every `lr-theme-change` and `lr-theme-preset-change` listener. Detail shapes differ, as the rename
  policy anticipates;
- every `data-lr-theme-preset` selector;
- the `themes/shadcn.css` import, with its replacement: `looks/shadcn.css` plus `data-lr-look="shadcn"`.
  Rewriting the import alone would render the Lyra look;
- the `theme/presets/shadcn.js` import. `LYRA_SHADCN_LOOK` is a `LyraLook`, not a preset, so it is
  not a drop-in replacement.

**Deprecation records.** The current records cannot express these deprecations. Stage 1 extends the
schema:

- `component-metadata.json#exportDeprecations` extends the existing package-level ledger. Named
  exports and DOM contracts are keyed by `module` and `name`; whole paths use `name`. Its kinds are
  `function`, `type`, `constant`, `entry-point`, `stylesheet`, `window-event` and `root-attribute`.
  Reuse `entry-point` for subpaths rather than introducing an equivalent second kind. Every record
  carries `since` and `removalNotBefore: 24.0.0`.
- RFC 0003's rename ledger, whose entries are keyed by component tag, gains report-only module-level
  review entries for module specifiers, exported names, window events and function calls. Its
  coverage check pairs them with the new records in both directions.
- `check:public-api`'s baseline records the new exports and deprecations in the same change.

## Alternatives considered

- **Keep one slot and compose maps with object spread (the status quo).** This cannot reset one
  choice without bookkeeping that belongs in the library. It cannot scope. It leaves stale overrides
  whenever that bookkeeping is wrong.
- **One preset per combination.** Looks × surfaces × densities × accents × modes is combinatorial for
  authors, for the contrast gate and for storage. "Change only the density" is still not
  expressible.
- **Extend `setLyraTheme()` in place.** `surface` would silently change from a colour to a treatment,
  and `auto` would become `system`. Both break callers without a type error, which contradicts "one
  property name, one meaning". New names behind a facade keep v21 code exact.
- **A separate theme engine per axis.** The roadmap rules this out. It would also duplicate storage,
  the bootstrap and the contrast floor.
- **Runtime-only axes, all as inline token maps.** This gives no scoping and no server rendering, and
  means larger records, a larger bootstrap and inline writes on every switch. The runtime form stays
  available for application looks and builder exports.
- **Class names such as `.lr-look-shadcn`.** Classes collide with application class vocabularies
  (the reason `theme.css` never adopted `.dark`). Namespaced `data-lr-*` attributes are consistent
  with `data-lr-theme`.
- **Resolve mode with `light-dark()`.** This was an earlier version of this proposal. Every
  mode-dependent value would become `light-dark(<light>, <dark>)`, and mode rules would set only
  `color-scheme`. The prototype built that form and rejected it:
  - It accepts colours only. Shadow geometry, lengths and numbers cannot be paired, and the shipped
    looks change shadow geometry per mode.
  - Application `color-scheme` would decide Lyra's mode. In all three engines, a page with
    `:root { color-scheme: light dark }` and no Lyra attribute turns dark when the operating system is
    dark. `data-lr-theme="dark"` with application `color-scheme: light` renders light.
  - Unlayered `:root` overrides would reach opposite-mode islands. In the prototype, dark text
    `rgb(34, 34, 34)` rendered on a dark surface at about 1.1:1.
  - Computed inputs would become `light-dark(…)` text, which a canvas `fillStyle` cannot resolve
    against an element's mode.
  - It needs Chrome 123 and Safari 17.5, above the planned floor.
  - It saves 0.16 KB gzip on `theme.css`. For mode switches it measured 14% and 46% slower than v21
    in two WebKit runs, and 3–6% slower in Chromium and Firefox.
- **Generate per-mode selector blocks for each look.** This works at the floor, but when look and
  mode islands are nested, source order decides the winner. The bytes also multiply with each look.
- **Public slot names instead of `lyraLookCss()`.** Hand-written CSS looks could then compose with
  modes and accents. But that would freeze about 250 names and the mechanism itself as public API
  (open question 1).
- **Registered custom properties (`@property`) for inputs or switches.** Registration is
  document-global, cannot be declared from shadow styles, and makes `var()` fallbacks unreachable.
  Reconsider in a later major.
- **Compose existing Lyra and native pieces only.** Applications can already set inputs per subtree.
  They cannot get persistence, pre-paint restoration, reset guarantees or cross-combination contrast,
  and each would re-implement the same machinery.

## Test, documentation, and rollout plan

### Feasibility evidence

A disposable prototype was built. It is not part of the repository.

- **What was built.** A generator produced three forms of `theme.css` from the v21 source: v21 itself;
  a `light-dark()` form; and this RFC's resolver, with the Lyra and shadcn looks as slots, nine named
  accents, follow switches and density switches.
- **How it was run.** A probe page loaded each form with the built package. Playwright 1.63 drove
  Chromium 153, Firefox 155 and WebKit 26.6.
- **Result.** This RFC's form passed every check: 45 of 45 in Chromium, which adds forced colours,
  and 37 of 37 in both Firefox and WebKit.

The checks covered:

- **Component parity with v21.** 76 hosts and shadow descendants, 9 computed properties each, in four
  mode contexts: light root, dark root, dark island, and light island in dark. Both operating-system
  schemes. In Chromium, forced colours too.
- **Application `color-scheme`.** It does not change Lyra's mode, in both directions.
- **Unlayered `:root` overrides.** They stop at mode islands exactly where v21's do (text colour, the
  strong-overlay foreground), and still inherit where v21's do (spacing).
- **Dark shadow geometry.** It matches v21.
- **Nesting across the three axes, three deep, in both orders:**
  - shadcn's primary follows a nested accent, in both modes;
  - an explicit Lyra look resets the subtle border and the letter spacing;
  - `data-lr-accent="none"` resets to the look's own accent;
  - `system` follows the operating system with no script;
  - the shadcn `.dark` alias works inside a shadcn scope and does nothing outside one;
  - inheritance through a nested shadow root works.
- **Computed values and runtime writes.** Computed inputs are plain values. Canvas `fillStyle`
  accepts them. CSSOM can write an empty switch.
- **Density.** The default path stays free of `calc()`, and `compact` scales padding and control
  height.

**Stage 1 merge gates (required by the acceptance decision):**

- a bootstrap prototype, with its measured gzip size and a proposed ceiling;
- the resolver generated from `canonical-tokens.json` rather than parsed from CSS;
- the switch benchmark on an idle machine, at 3,000 elements, and with 50 scopes present, including
  the accent switch against v21's runtime accent;
- parity over every registered component, not only six.

### Staged delivery

All stages land before v22.0.0, in this order.

1. **Item 1, the axis contract.**
   - The authored definitions, generators and resolver.
   - The attributes and sublayers.
   - The `setLyraStyle` family and `lyraLookCss`.
   - The version 2 record with v1 migration, the bootstrap, and the server helpers.
   - The facade and the deprecation records.
   - `looks/shadcn.css` and `LYRA_SHADCN_LOOK`, named accents and `accents.css`.
   - The observer updates and `check:style-axes`.

   Density and surface ship as validated values with their switches defined. Their definitions
   arrive in stage 3.
2. **Item 2, additive token foundations.**
   - A radius scale with button and container radius.
   - A fill-relative state-layer mix.
   - Tonal surface-container steps.
   - A heading font input.
   - A table row-height input.

   Each resolves to today's value when unset. Each lands in the Lyra and shadcn definitions only where
   it must differ. Items 3 and 5 depend on this stage.
3. **Items 5 and 4, in parallel.**
   - **Density presets** cover tables, forms, navigation and toolbars together, using the stage 1
     switches and the stage 2 row height. Before the presets ship, internal JavaScript length reads
     move to the length probe.
   - **The regular glass surface** comes through the shared mixin, with:
     - its clamps and fallbacks;
     - the nesting guard;
     - fixed-containing-block tests for anchored popups under glass ancestors;
     - the scrim-gated clear variant for media controls.
4. **Item 3, the Material-inspired look.** Both forms come from one definition, built on the stage 2
   foundations, with its visual scope documented (no ripple, no shape morphing). It is proven with
   every density and both surfaces.
5. **Item 8, chart palettes.** Validated categorical, sequential and diverging presets, including
   appropriate light/dark choices for every built-in look, through the stage 1 gate. Palette editor
   UI and advanced visual diagnostics follow in v23.
6. **Item 6, the preset gallery.** It previews real components across every axis, and exports
   validated runtime looks and `lyraLookCss()` output. The full builder follows in v23, alongside
   item 7's further looks.

The initial v22 release also includes the roadmap's six design-option foundations: contrast,
motion, typography, shape, elevation and chart palettes. Their usable inputs/presets, component
integration and accessibility coverage precede publication; advanced editors follow in v23.
See [style completion evidence](../roadmap.md#style-completion-evidence).

**Related items.**

- Item 30 (RFC 0002) treats every axis boundary as a theme scope and measures with scopes present.
  Its document-token switch may be deferred without blocking the axes; stage 1 must prove the
  explicit foreign-root stylesheet path independently.
- Item 25 folds per-component `compact` properties into size and density.

**Rollback.** Each stage adds new names and files. The facade keeps v21 code working throughout. The
resolver is internal: reverting `theme.css` to per-mode blocks changes no public name.

### Tests

- **Invariants (unit and browser).**
  - **Path independence:** random sequences of `setLyraStyle`, `resetLyraStyle` and facade calls
    leave the same attributes, inline values and ownership list as applying the final state once.
  - **Independence:** each field's change or reset leaves every other field's stored choice and
    owned overrides unchanged. Assert the expected recomputation of shared results, including
    look-relative density and accent contrast, rather than requiring those results to stay unchanged.
  - **No stale values:** after `resetLyraStyle()`, no Lyra-owned inline value remains, and
    application-owned inline values are never touched.
  - **Scopes:** replace semantics, `null` removal, ownership, and the RFC 0002 scope marker.
- **Scope matrix (Chromium, Firefox, WebKit).** The prototype's cases become permanent. They are
  extended to every pair of axes nested three deep in both orders, same-element combinations,
  component hosts as scopes, and `dir="rtl"`. Every case is asserted on rendered components with
  `getComputedStyle`, never on stylesheet text. The 320px-allocation and long-content fixtures rerun
  in `compact` and `touch`.
- **Parity.** Parity is defined on the used values of real properties, on pixel diffs, and on computed
  `--lr-theme-*` values after trimming. With no new attribute, import or call, results equal v21:
  - for every registered component;
  - in both modes, on the root, in islands, under forced colours, and with unlayered overrides and
    application `color-scheme` present;
  - with only `themes/shadcn.css`;
  - with only v21 calls through the facade.

  Visual-regression lanes cover the unchanged default.
- **Mode.**
  - `system` without script follows an emulated `prefers-color-scheme`.
  - Operating-system flips rewrite only root public values.
  - Canvas components repaint on every axis change.
  - Half-specified pairs keep v21 behaviour.
- **Renderer coverage.** Gallery and regression fixtures include `native.css` controls, headings
  and body text, code highlighting, canvas/chart labels and legends, virtualized rows, and open
  overlays. Verify that mode/look/density changes update their paints and measured geometry;
  document any intentional visual exception instead of claiming uniform coverage from buttons alone.
- **Bootstrap and storage.**
  - Pre-paint restoration of each axis, of both forms, and of custom accents.
  - v1 migration, and a version 2 record read and then written by v21 code.
  - Unusable storage.
  - The size ceiling.
  - Inline-script safety, through the existing checks.
- **SSR.**
  - Server rendering with `lyraStyleAttributes()`.
  - Hydration diagnostics report `ready` with unchanged markup.
  - Rendered-DOM equality across axis combinations.
  - Static-safe tags stay static-safe.
- **Accessibility.**
  - The contrast gate across the combinations above, including the glass composite rule and the
    clamped opacity.
  - Rendered target sizes, including the spacing exception at `compact`.
  - 200% text and WCAG 1.4.12 text spacing.
  - Forced colours for each look.
  - Reduced transparency (Chromium), increased contrast and reduced motion.
  - Axe checks on surface-honouring components in the glass and compact states.
- **Packaging.** Packed-consumer imports of every new subpath and type, the `sideEffects` and export
  checks, the layer-statement test, and the budgets.
- **Performance.** The switch benchmark and glass frame times. Hardware results stay recorded as
  pending evidence until measured on devices.

### Documentation and generated artifacts

- **`llms/shared.md`:** a "Style axes" section replaces "Theme mode/accent/surface runtime". It covers
  scoping, precedence, the length-read caveat for `compact` and `touch`, and consumer selectors:
  - `[data-lr-theme='dark']` needs the runtime;
  - pages without script use `data-lr-mode` together with `@media (prefers-color-scheme: dark)`;
  - the Tailwind `dark:` hookup keys on `data-lr-theme`.

  The cascade-layer and shadcn-look sections are updated. `llms/tokens.md` and the editor data gain
  the new inputs.
- **The v22 migration guide and release notes** cover the table and the behaviour changes above.
- **Storybook** gets one toolbar global per axis, replacing today's stylesheet swap for the look, plus
  combination stories that become the gallery.
- **`docs/design-token-system.md`** documents authored look definitions and the per-look interchange.
- **Regenerated:**
  - `design-tokens.json`;
  - `custom-elements.json`, for the `@cssprop` notes on surface-honouring components;
  - `llms/`;
  - the packaged skill references;
  - the component-quality data.

## Unresolved questions

1. **Closed: private.** The slots are `--_lr-*` private names written by `lyraLookCss()` and the
   runtime (`theme/look-css.ts`); the documented route for hand-written looks is
   `defineLyraLook()`/`lyraLookCss()`, and no slot vocabulary is published. Original question:
   **Slot names: private or public?** Keep slot names private and offer `lyraLookCss()`, as proposed,
   or publish a slot vocabulary so that hand-written CSS looks compose? Publishing freezes about 250
   names and the mechanism.
2. **Closed: shipped as proposed.** `setLyraStyle`, `LyraStyle`, `lr-style-change`, `data-lr-mode`,
   `accentBackground` (API) and `treatment` (record) exist in `theme/theme.ts`. Original question:
   **API names.**
   - `setLyraStyle`, `LyraStyle` and `lr-style-change` for the new family.
   - `data-lr-mode` for the requested mode.
   - `accentBackground` in the API for v21's `surface`.
   - `treatment` in the record for the surface axis.
3. **Closed: `material`.** The look is `theme/looks/material.js` with id `material`, documented as
   Material-inspired and unaffiliated. Original question: **The Material-inspired look's id.** Use `material`, or a neutral id such as `tonal` that implies
   no affiliation with a trademarked design system? The documentation would state the inspiration
   either way.
4. **Closed: removed in 24.0.0.** `themes/shadcn.css` and `theme/presets/shadcn.js` were removed;
   the `shadcn` look is part of `theme.css` and is selected with `data-lr-look`. Original question:
   **Fixed stylesheet form.** Remove `themes/shadcn.css` no earlier than v24, or keep fixed
   `themes/<id>.css` forms permanently as a one-look convenience?
5. **Closed: kept.** The runtime still reads and writes `data-theme` (the resolved mode, in the
   mode-attribute list); no removal is scheduled. Original question: **Future `data-theme` removal.** It is generic enough to collide with other libraries' theme attributes.
6. **Closed: one `accent` field.** A string that is a named palette selects it; the snapshot's
   `accentName` distinguishes a named palette from an identically named CSS colour in saved records,
   and the migration guide asks to review custom colours that share a gemstone name. Original
   question: **Named accents and CSS keywords.** Keep one API `accent` field in which names win (the
   `aquamarine` overlap), or split named accents into their own API field, as the record already does?
7. **Closed: nested glass chrome is opaque.** Nested glass chrome never repeats the blur, and
   independently promoted menus and modal panels start a new material root
   (`llms/shared/styles-and-tokens.md`). Original question: **Nesting guard scope.** Should a popover opened from a glass surface always be solid, as proposed,
   or only when it visually overlaps the glass?
8. **Closed: type never scales, factors private.** Density scales space and control sizes through
   private `--_lr-density-*` factors and a target floor; no font size or line height reads them.
   Original question: **Density values.** Item 5 sets the factors with visual review.
   - Confirm here that type never scales.
   - Confirm that the factors stay private in v22.
9. **Closed: no.** A `LyraLook` is `{ id, tokens }`; every look uses the one contrast-checked
   accent derivation. Original question: **Look-owned accent derivation.** May a look supply its own accent derivation, such as tonal
   palettes from a seed colour? This RFC says no for v22: one contrast-checked derivation for every
   look.
10. **Closed: not shipped.** There is one bootstrap; `createLyraThemeBootstrap()` takes `storageKey`
    and `restore: 'all' | 'mode'`, and no `inlineTokens` option or second asset exists. Original
    question: **Attributes-only bootstrap.** If the measured full bootstrap exceeds a ceiling that review
    accepts, ship a second asset of roughly 1 KB, via `createLyraThemeBootstrap({ inlineTokens: false })`,
    for applications that use only stylesheet forms?
11. **Future work, not scheduled.** The runtime does not suppress transitions when an axis switches.
    Original question: **Transition suppression.** Should the runtime suppress interactive transitions for the frame in
    which an axis switches, so that controls do not visibly fade between looks?
12. **Closed: explicit installation.** The adopted document layer (RFC 0002) does not carry the
    resolver or mode rules; an application-owned shadow root with local style boundaries installs
    `theme.css` and the selected look sheets itself, as the documentation says. Original question:
    **Resolver in foreign shadow roots.** Ship the resolver and mode rules (about 2 KB) inside RFC
    0002's adopted document layer, which adds them to the component core, or require an explicit
    adoption call for application shadow roots that carry axis attributes?
13. **Future work, not scheduled.** Toast regions mount on the owner document's body (or the native
    modal's mount target) and follow the document; there is no scope element to mirror. Original
    question: **Surfaces appended to `document.body`.** Should toast regions and `confirm()` accept a scope
    element to mirror, or should they keep following the document?
14. **Future work, not scheduled.** The Web Awesome migration reports nothing about its theme,
    palette or brand choices and maps none onto `data-lr-look` or `data-lr-accent`. Original question:
    **Web Awesome migration.** Web Awesome's public theming documentation offers separate theme,
    palette and brand choices. Should the migration script map those onto `data-lr-look` and
    `data-lr-accent` where Lyra has an equivalent, or only report them?
15. **Closed: follows the operating system.** The default mode is `system`, and `theme.css` with no
    mode attribute follows `prefers-color-scheme` (25.0.0). Original question:
    **Default mode without an attribute.** Keep `theme.css` light when no mode attribute is present,
    as proposed for compatibility, or follow the operating system from v23?
