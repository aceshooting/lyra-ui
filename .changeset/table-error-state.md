---
"@aceshooting/lyra-ui": minor
---

`<lr-table>`: a new built-in `error` state fills the gap between the existing `loading` and empty
states — until now, a failed data load had no built-in representation, so a consumer had to swap
the whole element out on error and lose the header, pagination, and filter context.

- `error` (boolean, reflected) replaces `<tbody>`'s row content with a built-in failed-load
  `<lr-empty>` while keeping the surrounding `<thead>`, filter field, and pagination mounted —
  unlike either existing data-empty branch, which this state overrides and which replace that
  chrome too. `errorHeading`/`errorDescription` override the built-in copy, mirroring
  `emptyHeading`/`emptyDescription`'s own contract; an `error` slot replaces the built-in content
  wholesale, mirroring the existing `empty` slot. The same `error`-prefixed `exportparts` scheme as
  `empty-*` (`error-base`/`error-icon`/`error-heading`/`error-description`/`error-actions`) makes
  it addressable without replacing it.
- A built-in `[part='retry-button']` emits a cancelable `lr-retry`: the default action clears
  `error`, and `preventDefault()` leaves it set for a consumer that owns its own retry timing.
- Precedence when more than one state could apply at once: `loading` beats `error` beats every
  empty branch, so a `loading` table never flashes a stale `error`, and an `error` table never
  falls through to "no rows"/"no columns" copy underneath it.
- A post-mount `error` transition is announced on the shared assertive light-DOM sink (distinct
  from the existing polite sink `loading`/empty-state copy already uses), guarded the same way the
  existing loading announcement guards its own first update.
