---
'@aceshooting/lyra-ui': minor
---

`<lr-activity-feed>` entries and light-DOM `<lr-option>` gain an opaque `data` payload

An activity-feed entry and a light-DOM `<lr-option>` can now carry an opaque `data` field — the
original source record behind a rendered row — reached by reference (never deep-cloned) wherever
the library already surfaces that row:

- `ActivityEntry.data` survives the owned `entries` snapshot and is handed back to `renderText` on
  every render, so a host needing richer per-entry context (grouping metadata, a nested list of
  related sub-items, the original record) no longer has to re-derive it by re-scanning its own
  source array by id.
- `<lr-option data>` is the light-DOM counterpart of an async combobox source row's own `data`
  field. `<lr-combobox>`'s `selectedRows` and the new `<lr-select>` `selectedData` getter both
  surface it, and both controls' `lr-input`/`lr-change`/`input`/`change` event details now carry a
  `data: readonly unknown[]` array alongside `value` — index-aligned with it, so `data[i]` is
  always the payload behind `value[i]` (`undefined` in that slot if that particular value
  currently matches no live row/option, rather than shifting every later entry). A consumer keying
  a picker on backend records can pass those records straight into `data` instead of stringifying
  an identifier into `value` and reversing the round trip in every change handler.
