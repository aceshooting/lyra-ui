---
"@aceshooting/lyra-ui": "minor"
---

`<lr-map>`: add `legendControlRole` for checkbox legend semantics.

Every `legendInteractive` row rendered as a `<button aria-pressed>`, which reads as a set of
pressed/unpressed actions rather than a checklist of independent show/hide toggles. The new
`legendControlRole: 'button' | 'checkbox'` property (default `'button'`) lets a consumer switch the
presentation without changing anything else: under `'checkbox'` the SAME `<button>` element renders
`role="checkbox"` and `aria-checked` (both `"true"`/`"false"`, inverted from `hiddenCategories`
exactly as `aria-pressed` was) in place of `aria-pressed`. The swatch, the label, the click handler
and the platform's own Enter/Space activation are unchanged, so the cancelable
`lr-map-legend-toggle` veto, `hiddenCategories` round-tripping, `group` sections and
`legendCollapsible` all compose with either role. With `legendControlRole` unset, the rendered
legend row is unchanged.
