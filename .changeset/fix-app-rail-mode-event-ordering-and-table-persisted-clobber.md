---
"@aceshooting/lyra-ui": patch
---

Fix two `storage-key` persistence bugs:

- `lr-app-rail`: a mount with a persisted `preferred-mode` could emit a real `lr-mode-change`
  carrying the wrong, pre-restore breakpoint-derived mode, immediately followed by a second,
  correct event once the restore landed — `connectedCallback()`'s breakpoint computation always ran
  before that same mount's `willUpdate()` had a chance to restore the persisted preference. The
  first mount's settled mode (whether from the initial breakpoint match alone, or a persisted
  `preferred-mode` overriding it) now always resolves before anything is announced, so a listener
  observes exactly one `lr-mode-change`, carrying the final mode, once the first render has landed.
  Live breakpoint crossings after mount and explicit `forceMode` assignments are unaffected.
- `lr-table`: `willUpdate()`'s persisted `priorityColumnsVisible` restore had no guard at all, so
  `<lr-table storage-key="…" priority-columns-visible>` (or a `.priorityColumnsVisible=${true}`
  binding) was silently overwritten by stale `localStorage` state on first update. An explicitly
  declared `true` now wins over the persisted value.

Also corrects the `storageKey` documentation for `lr-app-rail`, `lr-table`, and `lr-widget`, which
previously claimed all three implement an identical persistence-restore guard. They do not:
`lr-app-rail`'s undefaulted `railWidthPx`/`preferredMode` fields let it key the guard off
`willUpdate()`'s `changed` map; `lr-table`'s `priorityColumnsVisible` defaults to `false`, which
already reads as "changed" on every mount, so its guard instead checks the property's own current
value; and `lr-widget` uses a coarser single-shot flag set by any assignment, including its own
restore write.
