---
"@aceshooting/lyra-ui": major
---

A `checkbox-menu` filter type for `<lr-filter-bar>`, the rest of its definition passthrough, and
`<lr-data-grid>`'s all-columns visibility panel rebuilt on the same composition.

- `<lr-filter-bar>` gains a `'checkbox-menu'` filter type: a toolbar button that opens
  `<lr-dropdown>` plus one `<lr-dropdown-item type="checkbox">` (`role="menuitemcheckbox"`) per
  option, staying open across toggles so several categories can be switched in one visit. Its
  value is a `string[]`, identical to a `'combobox'` with `multiple`, so it joins the same `value`
  record, active-filter chips, `reset()` path, `required` validation and single full-value
  `lr-input` event as every other filter — which is exactly what a hand-assembled dropdown inside
  a `type: 'custom'` filter could not do. Rows are controlled by `value` rather than self-toggling,
  so a refused toggle can never leave a checkmark the bar disagrees with. Pick it over a combobox
  when the set is small and fixed and typing to filter would only be in the way.
- Filter definitions finish their passthrough to the control each one composes. `size`, `icon`
  (an inert, `aria-hidden` leading adornment) and the new `labelVisibility` now apply to every
  built-in type — `'select'` and `'date'`/`'date-range'` included, where the already-exported
  `filter-control-start` part had no way to be populated — and `clearable` applies to every type
  whose control ships a clear action, reaching `<lr-date-input>` under its own `with-clear`
  spelling. `'combobox'` adds `emptyText` for its no-matches row, and
  `LyraFilterBarOption.searchText` lets a `'combobox'` filter's short visible label still match a
  long canonical key (`'combobox'` only — `<lr-select>`'s type-ahead matches on the option label
  alone and never reads `search-text`).
  Everything stays optional and defaults to the composed control's own default, so existing filter
  definitions render byte-identically.
- `labelVisibility: 'hidden'` routes a filter's `label` to the composed control's own `aria-label`
  and — when the definition declares no `placeholder` of its own — to its placeholder, instead of
  rendering a stacked label above it. The label is re-routed, never dropped, so a compact toolbar
  row still names every field for assistive technology; the previous workaround was visually
  hiding `::part(filter-control-label)` in CSS, which removed the name along with the text.
- `<lr-data-grid>`'s `with-columns-menu` panel is now that same composition instead of a
  hand-rolled toggle button wrapping an inline `role="group"` of native checkboxes. It gains
  `role="menuitemcheckbox"` rows, roving focus and type-ahead, and its Escape and focus-return
  behaviour now comes from the shared overlay manager through `<lr-dropdown>` rather than from the
  grid's own overlay helper. **Potentially breaking for styling and tests:** `::part(columns-menu)`
  now resolves to the `<lr-dropdown>` itself, so a rule or query written against the former
  structure (`::part(columns-menu) > button`, a descendant `input[type="checkbox"]`) no longer
  matches. The `withColumnsMenu` property, the `lr-column-visibility-change` event and the
  `columns-menu` part name are unchanged. A grid detached and reattached while that menu was open
  now comes back closed, matching every other transient panel it owns.
