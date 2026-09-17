---
"@aceshooting/lyra-ui": minor
---

`<lr-map>` gains an opt-in interactive legend, so a categorical point layer's key can double as its
layer switch instead of needing a hand-built checkbox group positioned over the canvas.

`legendInteractive` (attribute `legend-interactive`, default `false`) turns every legend row that
carries the new `LyraMapLegendEntry.value` category key into a keyboard-operable toggle button.
`value` is the same string a `point.colors` / `point.icons` record matches against
`point.field` / `point.iconField`, so one set of category records can feed both the paint and the
key and the two cannot drift. It is distinct from — and does not derive from — the `value` on a
row's `icon` record, which is still dropped from the canonical readback as before. Rows without a
`value` stay inert even when `legendInteractive` is set.

`hiddenCategories: readonly string[]` is the controlled state, mirroring `<lr-chart>`'s
`hiddenDatasets`, and is honoured on first render rather than only after a user toggle. Activating a
toggle emits a cancelable `lr-map-legend-toggle` carrying the activated key, its proposed
visibility, and the complete proposed hidden set; `preventDefault()` is a real veto — nothing is
written, the row's `aria-pressed` does not change, the map is not repainted, and no announcement is
made — so a host can own the state itself. A programmatic `hiddenCategories` assignment reconciles
silently and emits nothing.

A hidden category's points, point icons and stroke are muted in the rendered MapLibre layers
through the new `--lr-map-hidden-category-opacity` (default `0.15`), resolved live from the cascade
because MapLibre paints to a WebGL canvas that never sees `var()`. The legend row itself dims only
its decorative swatch (`--lr-map-legend-hidden-swatch-opacity`, default `0.5`) and re-colors its
label through the quiet-text token, so the label keeps WCAG AA contrast rather than fading with the
swatch. New parts: `legend-toggle` and `legend-toggle-hidden`.

Each toggle is an ordinary tabbable `<button>` with `aria-pressed` rendering both `"true"` and
`"false"`, matching `<lr-chart>` and `<lr-graph-legend>` rather than introducing a third legend
vocabulary; a long interactive legend therefore contributes one tab stop per keyed row. Show/hide
state changes are announced through the shared light-DOM live region.

With `legendInteractive` left unset, the legend DOM and every MapLibre paint property are
byte-identical to before: no button is rendered and `circle-opacity` is never written at all.
