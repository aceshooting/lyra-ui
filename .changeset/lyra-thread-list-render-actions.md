---
"@aceshooting/lyra-ui": minor
---

`lyra-thread-list` gains a `renderActions?: (thread: ChatThread) => TemplateResult` data-mode
property, an escape hatch for a fully custom per-row action surface (e.g. a `<lr-menu>` with
Rename/Delete, a rename dialog, delete-confirmation state) that the existing `rowActions`'s closed
`pin | archive | delete` set can't express. Its content is appended after any built-in `rowActions`
buttons in the same row's `actions` slot -- additive, not a replacement, the same composition
direction `wrapRow` already takes elsewhere on the row. Set `rowActions` to `[]` (its default) to
use only the callback's content. `renderActions` is re-invoked per row on every render with the
current thread (never memoized/stale) and its content sits as a DOM sibling of the row's own
selectable region, so activating a custom action never also fires `lr-select` -- the same
structural mechanism the built-in row-action buttons already rely on. Leaving `renderActions`
unset leaves `rowActions`' rendered output byte-for-byte unchanged, and `wrapRow` continues to
compose independently around the result either way.
