---
"@aceshooting/lyra-ui": minor
---

New opt-in stylesheet `@aceshooting/lyra-ui/tokens-root.css` publishes a curated subset of the
resolved `--lr-*` layer at document scope, so an application's own custom elements can read the
kit's tokens.

`theme.css` ships the `--lr-theme-*` INPUT layer at `:root`, but the resolved OUTPUT layer
(`--lr-color-*`, `--lr-space-*`, `--lr-radius`, `--lr-shadow-*`, `--lr-font-*`) is declared only
inside each `lr-*` component's own shadow `:host`. An app's own elements are not descendants of any
`lr-*` host, so nothing inherits it to them. Consumers measured the consequence in Chromium rather
than inferring it: at document scope `--lr-color-brand`, `--lr-color-border` and `--lr-focus-ring`
all resolve to the empty string while `--lr-theme-focus-ring-width` resolves fine. One project found
550 `var(--lr-*)` references in its own components reading nothing — 358 with no fallback at all,
the rest silently running on a literal fallback that never tracked the theme. Neither failure is
detectable without reading computed styles in a browser, because an undefined custom property is not
an error.

The subset is curated rather than complete, deliberately: `--lr-*` is documented as the internal
output layer precisely so it can change without a major, and publishing all of it would make several
hundred names permanent public API. 114 names are in — ambient surfaces/text/borders, the semantic
colour grid and its flat aliases, the spacing scale, radii, border widths, elevation, font sizes and
weights, the focus-ring parts, and the base motion pair — each with a stated reason in the file, as
is each deliberate omission.

It is generated from the same canonical token source as everything else, so it cannot drift, and a
fail-closed validator in the existing `check:design-tokens` gate rejects a curated token whose value
reaches an internal name the file does not declare — the case that would otherwise ship an empty
`var()` at `:root`. Ramp references resolve to literals at generation time and stay behind their
`--lr-theme-*` input, so the file is self-sufficient without `theme.css`, still fully rethemable,
publishes no ramp names, and computes byte-identical values to what a component reaches through the
ramp.

Opt-in, and layered in `lr-theme` like `theme.css`, so it changes nothing for anyone who does not
import it and an app's own unlayered rules still win.
