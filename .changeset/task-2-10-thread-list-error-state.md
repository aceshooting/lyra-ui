---
'@aceshooting/lyra-ui': minor
---

`<lr-thread-list>` gains the same `error` failed-load state `<lr-table>` already has.

- `error` (boolean, reflected), `errorHeading`, and `errorDescription` — data mode only: while
  `error` is set, the built-in failed-load `<lr-empty>` (the same `error`-prefixed exported parts
  and `[part='retry-button']` as `<lr-table>`) replaces the virtual list/built-in empty state.
  `error` beats the built-in empty state.
- An `error` slot replaces the built-in content wholesale, alongside the existing `empty` slot.
- A built-in `[part='retry-button']` emits a cancelable `lr-retry`: the default action clears
  `error`, and `preventDefault()` leaves it set for a consumer that owns its own retry timing.
