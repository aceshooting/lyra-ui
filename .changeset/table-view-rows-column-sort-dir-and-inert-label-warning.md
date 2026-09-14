---
"@aceshooting/lyra-ui": minor
---

`<lr-table>`: three additive changes, all no-ops when unused.

- New public readonly `viewRows`/`pageRows` getters expose the table's own filtered/sorted rows
  (`viewRows`, ignoring pagination) and the currently rendered page of them (`pageRows`), so a
  consumer that needs "what the grid currently shows" (e.g. to export it) can read them instead of
  re-implementing filtering, sorting, and pagination. Both return a fresh, frozen array on every
  read; mutating the result cannot reach the table's own internal state.
- `columns[].defaultSortDir` lets one column declare its own initial sort direction the first time
  header activation makes it the active `sortKey`, taking precedence over the element-level
  `defaultSortDir` (which remains the fallback when a column omits it) — useful for a mixed
  text/numeric table where, say, a "last updated" column should start descending while the rest
  start ascending. Re-activating a column that is already `sortKey` still only toggles between
  `'asc'` and `'desc'`.
- Setting `revealColumnsLabel`/`hideColumnsLabel` while no column declares `priority` is always
  inert, since `[part='reveal-columns-button']` never renders without at least one `priority`
  column. This now logs a one-time, development-only, production-silent `console.warn` for it,
  matching the existing missing-accessible-name diagnostic's shape.
