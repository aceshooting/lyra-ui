---
'@aceshooting/lyra-ui': minor
---

`<lr-knowledge-base>` gains the same `error` failed-load state `<lr-table>` already has.

- `error` (boolean, reflected), `errorHeading`, and `errorDescription` — forwarded to the nested
  `<lr-table>`, whose own built-in failed-load state (with its retry button) replaces the source
  rows while it's set, keeping the toolbar and summary mounted around it. `error` beats the nested
  table's own empty state.
- An `error` slot replaces the built-in content wholesale.
- A cancelable `lr-retry` mirrors `<lr-table>`'s own contract: the default action clears `error`,
  and `preventDefault()` leaves it set. This component intercepts the nested table's own `lr-retry`
  and re-proposes its own, so the outer `error` property never drifts out of sync with the nested
  table's internal state.
