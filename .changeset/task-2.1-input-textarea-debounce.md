---
'@aceshooting/lyra-ui': minor
---

`<lr-input>` and `<lr-textarea>` gain an opt-in `debounce` (ms) property and a new
`lr-input-settled` event, so a search-as-you-type field no longer needs its own hand-rolled timer.

- `debounce?: number` — how long to wait after the last keystroke before emitting one
  `lr-input-settled` (`detail: { value }`, non-cancelable), while `input`/`lr-input` keep firing on
  every keystroke exactly as before. Omitted, `0`, or a non-finite value means no debounce at all
  — `lr-input-settled` never fires, and existing behavior is byte-identical.
- A pending debounce is flushed immediately by `change`, Enter, or blur, so a blur or submit never
  drops the last keystroke.
- A pending debounce is cancelled with no stray settle by disconnection, `<lr-input>`'s built-in
  clear button, and a programmatic `value` write (including a form reset).
- Both components share the same `DebounceController` primitive `<lr-filter-bar>`'s own per-filter
  `debounce` already uses, so the three surfaces (`<lr-input>`/`<lr-textarea>`, `<lr-filter-bar>`,
  and `<lr-combobox>`'s `sourceDelay`) now document one consistent contract.
