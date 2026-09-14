---
"@aceshooting/lyra-ui": minor
---

Three additions to `<lr-filter-bar>`, every new token byte-identical to today's rendering when
unset.

- **The per-filter field wrapper is now a themeable public part.**
  The row-stacking wrapper around each filter's composed control was a bare, untokenized
  `.filter-field { flex: 1 1 var(--lr-size-12rem); }`, with zero `@cssprop` entries anywhere on
  the component. It is now `part="field"`, with its flex-basis themeable via
  `--lr-filter-bar-field-basis` (still `var(--lr-size-12rem)` by default). The `controls` row's
  own previously-hardcoded gap is likewise now `--lr-filter-bar-gap` (still `var(--lr-space-s)` by
  default).
- **A new `end` slot holds host-supplied trailing actions next to the
  reset button.** `<lr-filter-bar>` had zero host-level slots, so a consumer wanting a "Save
  search" or "Export" action beside the built-in reset had nowhere to put it short of wrapping the
  whole component. `end` renders inside the new `end` part (itself inside `[part="controls"]`,
  next to `reset-button`) and stays `hidden` -- claiming no layout space -- while nothing is
  slotted, matching the adornment-slot vocabulary (`start`/`end`) and the `header-actions`-style
  precedent set by `<lr-details>`/`<lr-card>`/`<lr-dialog>`.
- **`'text'`/`'combobox'` filter definitions now forward
  `clearable`/`size`/`icon` (plus, `'text'`-only, `inputType`) to their composed
  `<lr-input>`/`<lr-combobox>`.** `renderControl()`'s `'text'`/`'combobox'` branches hardcoded
  `type="text"` and never set `clearable`/`size`/a `start`-slot adornment, even though
  `INPUT_EXPORT_PARTS`/`COMBOBOX_EXPORT_PARTS` already forwarded `start`/`clear-button` -- those
  forwarded parts were provably unreachable. All four new fields are optional and default to the
  composed control's own default (`clearable: false`, `size: 'm'`, `inputType: 'text'`, no icon),
  so an existing filter definition renders unchanged. `'combobox'` also gains the same optional
  `debounce` (ms) `'text'` already had, coalescing a burst of rapid selection changes (picks, a
  multi-select toggle, an `allowCustomValue`/`allowCreate` commit, or the clear action) into one
  delayed commit. Unlike `'text'`'s uncontrolled-with-sync field, the composed `<lr-combobox>`'s
  `.value=` binding stays fully controlled throughout a pending debounce: it renders the pending
  selection rather than the last-committed value, so the control's own display never reverts
  mid-delay. A pending debounce is flushed by the control's own blur and cancelled by `reset()`, a
  chip removal, and disconnection -- identical to `'text'`.
