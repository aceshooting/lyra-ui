---
"@aceshooting/lyra-ui": minor
---

Four follow-ups to 11.0.0, all reported against the shipped release:

- **`<lr-date-input>` forwards `presets`** to its nested picker, and exports the `presets` /
  `preset-button` parts. 11.0.0 landed the feature on the inline calendar only, while the compact
  text-field-plus-popover shape is the one a dashboard time filter actually uses — and there was no
  consumer-side escape hatch, since a CSS part cannot set a JS property.
- **`<lr-date-picker>` gains a read-only `appliedPreset`**, reporting which preset produced the
  current value (`undefined` for a hand-picked range). 11.0.0 presented commit-path
  indistinguishability as a feature; it is, for serialization and clamping, but it destroyed the one
  fact a dashboard filter needs, because "Last 7 days" must stay *relative* across a reload.
  Re-deriving it by matching `value` is both the mapping table `presets` exists to delete and
  ambiguous — Today and This month coincide on the 1st.
- **`LyraDateRangePreset.start`/`.end` are now optional**, meaning an open bound that resolves to
  `min`/`max`. The changelog and doc comment advertised an "All time" preset that the type could not
  express and `applyPreset` silently ignored, so that button rendered and did nothing. Where the
  matching `min`/`max` is unset the button now renders **disabled** rather than looking live.
- **`<lr-lite-chart>` gains `showDataTable` and `dataTableToggle`** with the same semantics and the
  same `data-table-toggle` part as `<lr-chart>`. It extends `LyraElement` directly and inherited
  nothing from the 11.0.0 addition, which left the component that exists to avoid the Chart.js peers
  as the only one still needing a hand-rolled `<details>` — or Chart.js, for a button.
