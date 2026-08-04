---
"@aceshooting/lyra-ui": minor
---

Add a `click()` override to five multi-control form wrapper elements —
`<lr-radio-group>`, `<lr-checkbox-group>`, `<lr-rubric-form>`, `<lr-graph-query-builder>`, and
`<lr-tool-param-form>` — so a host click (whether from a `<label for>` association or a
programmatic `.click()`) reaches the first relevant internal control instead of being a no-op.
`<lr-radio-group>` activates its selected (or first enabled) radio, matching its own `focus()`
override; the other four move focus to their first field.
