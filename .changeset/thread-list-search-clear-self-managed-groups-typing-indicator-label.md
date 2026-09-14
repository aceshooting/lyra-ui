---
"@aceshooting/lyra-ui": minor
---

Three additions to `<lr-thread-list>` and `<lr-typing-indicator>`.

- `<lr-thread-list>`: the built-in search field's native `::-webkit-search-cancel-button` was
  suppressed with nothing replacing it, so Chromium users lost the clear affordance the native
  control gave them. A `part="clear-button"` icon button now renders next to `[part="search-input"]`
  once it has a value, with a localized `this.localize('clear')` accessible name (reusing the same
  key and part vocabulary `<lr-input>`'s own `clearable` contract already uses), a keyboard-reachable
  `<button>`, and the shared `--lr-icon-button-size` hit-area floor. Clicking it clears the field,
  fires the same `lr-filter-change`/`lr-query-change` event the field already fires while typing, and
  returns focus to the input. A sibling button was chosen over composing `<lr-input>`: this search
  field is not a form control, and swapping its raw `<input part="search-input">` for `<lr-input>`
  would turn the long-documented `search-input` part from the actual input element into a wrapper
  custom element (breaking any consumer style written against it) while pulling in
  `<lr-input>`'s label/hint/error/password/form-associated machinery this field has no use for.
- `<lr-thread-list>`: the built-in group-collapse toggle previously only emitted `lr-group-toggle`
  and never mutated `collapsedGroupIds` itself, so it visibly did nothing unless a consumer manually
  listened and reassigned the property. It now self-manages by default, mirroring
  `<lr-chat-message>`'s and `<lr-code-block>`'s own request/commit event pairs: a new cancelable
  `lr-group-toggle-request` fires first, and unless a listener calls `preventDefault()` on it, this
  component updates `collapsedGroupIds` itself before announcing the accepted change with the
  existing `lr-group-toggle` (same `detail: { groupId, collapsed }` shape as before, unchanged).
  **Compatibility:** an existing consumer that already listens for `lr-group-toggle` and reassigns
  `collapsedGroupIds` itself keeps working unchanged -- nothing calls `preventDefault()` on the new
  request event by default, so `lr-group-toggle` still fires exactly as it always did, and this
  component's own write always happens before that listener runs (same synchronous dispatch), so the
  host's own assignment simply wins last. A consumer that must veto a collapse change and stay fully
  controlled listens for `lr-group-toggle-request` instead and calls `preventDefault()`, which skips
  the built-in write and suppresses the following `lr-group-toggle` entirely.
- `<lr-typing-indicator>`: adds a `labelPlacement` property (`'none'` default, `'after'`), mirroring
  `<lr-spinner>`'s own `labelPlacement` vocabulary. The default keeps today's screen-reader-only
  rendering byte-identical (a single `.sr-only` text node, no visible label); `label-placement="after"`
  instead renders the label (or its localized "Thinking…" fallback) visibly next to the animated
  shape in a new `part="label"` element.
