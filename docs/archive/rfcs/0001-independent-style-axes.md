# Archived: RFC 0001: Independent style axes

Moved from [0001-independent-style-axes.md](../../rfcs/0001-independent-style-axes.md); history before 30.0.0, not current guidance.

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
[RFC 0003](../../rfcs/0003-lyra-v21-migration-profile.md) only reports these changes; it does not rewrite them.
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
See [style completion evidence](../../roadmap.md#style-completion-evidence).

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
