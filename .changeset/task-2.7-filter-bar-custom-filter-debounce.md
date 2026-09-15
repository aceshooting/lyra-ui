---
'@aceshooting/lyra-ui': minor
---

`<lr-filter-bar>`'s `'custom'` filter type now accepts the same optional `debounce` its `'text'`
and `'combobox'` types already had.

- `LyraFilterBarCustomDefinition.debounce?: number` delays committing whatever the adapter's
  `valueFromEvent` reads off `context.onValueChange`/`onInput`/`onChange`, coalescing a burst of
  rapid commits (keystrokes, toggles, anything the custom control fires) into one delayed `value`
  write and a single `lr-input`. Omitted, `0`, or a non-finite value means no debounce at all —
  every commit lands immediately, exactly as before this field existed.
- While a commit is pending, `context.value` carries that pending value instead of the
  last-committed one, so a custom control bound to it as a fully controlled value never reverts
  mid-delay.
- A pending commit is flushed by `context.onFocusout` and cancelled outright by `reset()`,
  removing that filter's active-filter chip, and disconnection — identical to `'text'`'s and
  `'combobox'`'s own debounce.

This closes the gap those two types' debounce left: previously a custom free-text filter had to
hand-roll the same timer, flush, and cancellation lifecycle itself to get equivalent behaviour.
Fully optional and additive — an existing `'custom'` filter definition keeps committing
immediately, unchanged.
