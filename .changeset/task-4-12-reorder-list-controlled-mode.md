---
"@aceshooting/lyra-ui": minor
---

`<lr-reorder-list>` gains an opt-in `controlled` mode, and `<lr-reorder-item>` gains a public
`focusMoveButton()` method.

- `controlled` (reflected, default `false`): an accepted move no longer moves this list's own
  slotted `<lr-reorder-item>` nodes itself. Instead it waits for the host to reorder its own
  backing data and re-render the slotted items to match — the same controlled request `<lr-tree>`'s
  `reorderable` already establishes for its `data`-driven children — and reconciles by each item's
  `value` rather than by element reference, so a host re-render that recreates the moved row (or
  merely rewrites `value` on the elements already at each position, the common outcome of a
  non-keyed `Array.map()`) still completes the move once the resulting order matches. The list
  stays `aria-busy`/`:state(busy)` for the whole wait, matching a `preventDefault()`-held move;
  a re-render that never reaches the emitted order leaves the move pending indefinitely, and one
  that drops the moved `value` entirely cancels it silently, with no announcement.
- `<lr-reorder-item>.focusMoveButton(direction: 'up' | 'down'): boolean` moves focus onto that
  row's move-up/move-down control (returning whether it did), the same way the owning list already
  restores focus after a move — now also available to a host driving `controlled` mode directly,
  including onto a freshly recreated element instance.
- `<lr-reorder-list>.revertPendingMove()` accepts an options object,
  `revertPendingMove(options?: { silent?: boolean })`, to suppress the built-in
  `reorderMoveCancelled` announcement when a host is deferring the decision to a flow of its own
  (a confirmation dialog, say) that will communicate the outcome itself.
