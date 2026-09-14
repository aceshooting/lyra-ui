---
'@aceshooting/lyra-ui': minor
---

`<lr-combobox>` reports async source failures properly and gains a public `refresh()`

A rejected `source` call now renders the library's shared failed-load state inside the listbox —
the same `<lr-empty>` shape `<lr-table>` uses, with the same `retry-button` — instead of a
one-line message with no way forward. The precedence is the library-wide one: loading beats error
beats empty, so a retry in flight never flashes the stale failure and a failure is never hidden
behind "no matches" copy.

New surfaces:

- `lr-source-error` — non-cancelable, `detail: { error }` carrying the raw rejection, so a host can
  log or report it. The rendered copy stays localized and never shows it.
- `lr-retry` — cancelable; the built-in action calls `refresh()`, and `preventDefault()` leaves the
  failure on screen for a host that owns its own retry timing.
- `refresh()` — re-runs the current query without changing the source's identity, its debounce
  controller, or its delay. This is the missing way to invalidate a *stable* `source`: reassigning
  the property was the only other route, and that clears the fetched rows and the pending-selection
  cache because it means "a different provider". Called while the listbox is closed, it queues for
  the next open.
- `source-error` slot and the `source-error` / `source-error-row` / `retry-button` parts, for
  replacing or restyling the state. It is named apart from the form control's own `error` slot
  deliberately: they are different failures and a field has to be able to show both.
