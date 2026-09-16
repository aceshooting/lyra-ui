---
'@aceshooting/lyra-ui': minor
---

`<lr-data-grid>` gains the same `error` failed-load state `<lr-table>` already has.

- `error` (boolean, reflected), `errorHeading`, and `errorDescription` — while `error` is set, the
  body's single row becomes the built-in failed-load `<lr-empty>` (the same `error`-prefixed
  exported parts and `[part='retry-button']` as `<lr-table>`), keeping the header, toolbar, and
  pager mounted around it. `loading` beats `error` beats every empty/no-columns/no-results branch.
- An `error` slot replaces the built-in content wholesale.
- A built-in `[part='retry-button']` emits a cancelable `lr-retry`: the default action clears
  `error`, and `preventDefault()` leaves it set.
- `error` is host-controlled, like every other property here: the internal `dataSource` request
  cycle's own `lr-data-error` event does not set it, since that event's existing contract keeps
  prior rows rendered on a rejection. A consumer that wants a specific failure to replace the row
  content with the new built-in state sets `error = true` from its own `lr-data-error` listener.
