---
'@aceshooting/lyra-ui': major
---

8.0.0 — one styling vocabulary, a colour system that works in the dark, and a migration promise that is actually true.

This release is mostly about removing accidents: names that meant two things, values that were only ever solved for light mode, and a mirror table that claimed more than the components could honour. Almost every break below is a rename with a mechanical fix.

### The migration promise

`wa-*` and `sl-*` → `lr-*` is now a checked claim rather than a documented intention. `scripts/check-migration-coverage.mjs` runs in CI and fails when a README mirror row names a counterpart the element cannot honour; a dry-run codemod over a fixture of all 145 upstream tags is what produces its numbers.

- **Both upstream spellings of the clear button are now accepted** on `lr-input`, `lr-select` and `lr-combobox`. Shoelace spells it `clearable`, Web Awesome spells it `with-clear`, and each control previously honoured only one — so half of all migrations silently lost the control. Neither spelling is deprecated: deprecating Web Awesome's own name would work against the promise.

### Attribute renames (breaking)

Every one of these is a find-and-replace. Where the default flips, the behaviour is the upstream one.

| 7.x | 8.0.0 | Note |
|---|---|---|
| `no-light-dismiss` | `light-dismiss` | polarity un-inverted; default flips to off |
| `hide-summary` | `with-summary` | polarity un-inverted; default flips to off |
| `total-items` | `total` | |
| `<lr-avatar src>` | `<lr-avatar image>` | |
| `<lr-drawer>` default `placement` | `start` → `end` | matches the upstream default |
| `<lr-tabs>` | `<lr-tab-group>` | plus `lr-tabs-change` → `lr-tab-show`/`lr-tab-hide`, and `--lr-tabs-*` → `--lr-tab-group-*` |
| `<lr-tree-node>` | `<lr-tree-item>` | |
| `<lr-slider>` `fill` part | `indicator` part | |

### Colour, in both modes

The palette is generated from a numeric ramp and a 45-slot semantic grid, and `scripts/check-contrast.mjs` proves 367 pairs across light and dark on every run. Colours shifted where the generated ramp put them — the brand seed moved `#0969da` → `#035ec6`. Restoring the old hexes would reintroduce the failures the ramp exists to prevent.

- **Dark mode had no elevation.** `--lr-shadow` was a single black step at 12–22% alpha, which against a near-black surface is not a luminance difference at all. There are now five steps (`--lr-shadow-xs` … `-xl`), declared per mode with roughly tripled dark alphas, and every call site is tiered by role. A theme that set `--lr-theme-shadow-color` keeps working; one that overrode `--lr-shadow` directly should move to the step it meant.
- **Modal panels no longer share the page surface token.** New `--lr-color-surface-overlay`: the page surface in light mode, lighter than the page in dark. Before this, an open dialog in dark mode was a scrim with text floating on it and no visible panel. Both scrims (`--lr-color-overlay`, `--lr-color-overlay-strong`) also gained dark values.
- **The terminal's ANSI palette is now two token sets.** `--lr-terminal-color-*` remains the foreground set; SGR 40-47/100-107 now read a new `--lr-terminal-bg-*` set solved against the panel's default text. One set could not serve both roles: once the foregrounds were solved to be legible on a light panel they were all dark, so `ESC[41m` painted a near-black red behind near-black default text. `white` and `black` also no longer resolve to the same hex, which had made `ESC[30;47m` invisible text on its own colour.

### Interaction states

`filter: brightness()` is gone as the hover mechanism. It multiplies every channel — so it lightened a dark control and darkened a light one only by coincidence, did nothing whatsoever to a pure white or black fill, and shifted the control's text and icons along with its background. Hover and press are now a colour mix toward `--lr-color-mix-partner`, tunable library-wide through `--lr-color-mix-hover` / `--lr-color-mix-active`. `--lr-hover-brightness` still resolves but no component reads it.

Every interactive part that responds to `:hover` now also responds to `:active`, enforced by `scripts/check-interaction-states.mjs`.

### One styling vocabulary

`variant`, `tone` and `kind` meant the same thing on different components; `appearance` meant two unrelated things; twenty-two size unions covered four different ladders. The shared vocabulary now lives in one place.

- **`tone` → `variant`** on `lr-avatar`, `lr-avatar-group`, `lr-chip` and `lr-confirm-bar`, and on the activity-feed / tree-badge data fields. No alias.
- **`appearance="card|plain"` → `frame="card|plain"`** on the thirteen container components that had it. `appearance` now means the fill vocabulary only: `accent | filled | outlined | filled-outlined | plain`.
- **`lr-button`'s default `appearance` is now `accent`**, and `filled` is a genuinely different, quieter tier — the two used to render identically for every variant except neutral, where `filled` resolved to the page background.
- **`size` accepts both ladders everywhere**: the library's `2xs|xs|s|m|l|xl` and Web Awesome's `small|medium|large`.
- **Numeric properties that were misnamed `size` are renamed**: `lr-attachment-chip` and `lr-file-icon` take `bytes`; `lr-dock-panel` takes `extent` (with `min-extent`/`max-extent`).
- **`lr-badge`, `lr-tag` and `lr-chip` are no longer unconditionally pill-shaped.** They default to a rounded rectangle; add `pill` for the old shape.

### Tokens and theming

- **CSS cascade layers.** `theme.css` declares `@layer lr-base, lr-theme, lr-utilities, lr-overrides` and its tokens sit in `lr-theme`. Any *unlayered* consumer declaration now beats every Lyra one regardless of specificity or load order. If you previously wrapped your overrides in your own `@layer`, they now sort relative to `lr-theme` instead of losing to an unlayered `:root`.
- **Compound motion tokens are split** into duration and easing.
- **`--lr-font-size-md` is removed**; use `--lr-font-size-m`. The two were the same value under two names, which is why `lr-button` rendered `size="m"` and `size="l"` at identical text sizes.
- **New `--lr-form-control-*` tier** (height, font-size, padding, gap, radius), one ladder shared by every control.

### Localization

- **Pluralized messages are now CLDR category objects**, selected through `Intl.PluralRules`, replacing the paired `<key>` + `<key>Plural` convention. A catalog registered through `registerLyraLocale()` or a per-instance `.strings` that used the old pair must be rewritten as `{ one: '…', other: '…' }` — with that locale's real categories, which for Russian is four and for Arabic six.
- **Eight translation catalogs ship**, as side-effect-only modules: `import '@aceshooting/lyra-ui/translations/de';` and so on for `ar`, `es`, `fr`, `ja`, `pt-BR`, `ru`, `zh-CN`.

### Packaging

- **`@aceshooting/lyra-ui/internal/*` is no longer a published subpath.** The supported helpers live under `@aceshooting/lyra-ui/utilities/*`, which now also carries `FormAssociated` and `groupByRecency` — previously reachable only through the side-effectful root barrel.
- **`lr-flag`'s deprecated `detailed` boolean is removed**; use `variant="detailed"`.
- **`lr-combobox`'s `withClear` alias is removed** in favour of the two upstream spellings above.
