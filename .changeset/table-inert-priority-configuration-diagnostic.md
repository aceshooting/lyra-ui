---
"@aceshooting/lyra-ui": minor
---

`<lr-table>`'s inert-configuration warning now covers the whole priority-column family, and the
reveal control's availability is publicly readable.

- The development-mode diagnostic previously fired only for `revealColumnsLabel`/`hideColumnsLabel`.
  It now also names `priorityColumnsVisible` and `storageKey` when either is configured on a table
  where no column declares `priority` — both are equally inert there, since there are no hide rules
  to override and nothing else is persisted. One warning lists every inert member, so a table
  configured with all three does not teach the author to fix them one reload at a time. It stays
  production-silent and page-bounded, as before.
- The diagnostic no longer fires while `columns` is still empty. A table configured in markup
  routinely receives its columns a tick later, and warning at that point also spent the
  page-bounded diagnostic on a table that was about to be configured correctly.
- New read-only **`priorityColumnsToggleAvailable`** reports whether the reveal/hide control is
  currently offered at all — the public counterpart of the measurement
  `[part='reveal-columns-button']` itself renders from. It is true while at least one `priority`
  column is actually hidden at the current allocation and stays true once `priorityColumnsVisible`
  has revealed them, so a host can mirror the control (or explain its absence) instead of
  re-measuring the grid itself. Remeasured after every render and container resize; read it after
  `await table.updateComplete`.
