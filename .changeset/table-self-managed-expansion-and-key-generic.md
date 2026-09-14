---
"@aceshooting/lyra-ui": minor
---

`<lr-table>` can now own its row expansion, and its row-key type is parameterizable.

- **`expansionMode` (`expansion-mode`, reflected, `'none' | 'single' | 'multiple'`, default
  `'none'`)** mirrors `selectionMode` member for member. The default keeps today's behavior
  exactly: `expandedRowKeys` stays consumer-controlled and a chevron activation only reports
  `lr-row-expand-toggle`. Set `'single'` or `'multiple'` and the table maintains the set itself,
  so an expandable table works with no host-side handler at all. `'single'` keeps at most one row
  open, and assigning `expansionMode = 'single'` coerces an already-larger `expandedRowKeys` down
  to its first key the same way `selectionMode` does for `selectedRowKeys`. An unrecognized
  attribute value falls back to the controlled behavior rather than self-managing.
- **New cancelable `lr-row-expand-request`** (frozen readonly `detail: { row, rowKey, expanded }`)
  precedes each self-managed change. `preventDefault()` skips the built-in `expandedRowKeys` write
  and suppresses the following `lr-row-expand-toggle`, handing that one change back to the host —
  the same request/commit pair `<lr-thread-list>`, `<lr-chat-message>`, and `<lr-code-block>` use.
  It is never emitted under the default `'none'` mode.
- **`lr-row-expand-toggle`'s detail gains `expanded`**, the state the activation resolves to, so a
  listener no longer has to derive it from `expandedRowKeys`. The existing `row`/`rowKey` fields
  are unchanged. Under a self-managed mode this event follows an accepted request and the write has
  already landed, so reading `expandedRowKeys` from the listener sees the new state.
- **`'single'` reports the row it displaces.** Closing a row to make room for another is an
  expansion change like any other, and `lr-row-expand-toggle` is the only per-row expansion event
  there is, so `'single'` fires it once with `expanded: false` for the displaced row immediately
  before the accepted one. A host mirroring open rows from that event alone therefore stays correct
  instead of believing the displaced row is still open. The one boundary: a displaced row that is
  filtered or paged out of view has no `row` object for the detail to carry, so that case is
  reported through `expandedRowKeys` alone — as is the `expansionMode = 'single'` coercion above,
  for the same reason.
- **No mode clears keys when the visible rows change.** Filtering, sorting, and pagination leave
  `expandedRowKeys` alone, so a row filtered or paged out of view comes back expanded and a key
  matching no current row simply renders nothing until one exists again — the convention
  `selectedRowKeys` already follows for server pagination. This is now stated explicitly rather
  than left to be inferred.
- **`LyraTable<T, K = string | number>`** takes a second type parameter for the row-key type, used
  by `rowKey`'s return type and every event detail's `rowKey`/`rowKeys`, plus `selectedRowKeys` and
  `expandedRowKeys`. `LyraTable<Row, number>` now reads `event.detail.rowKey` as `number` with no
  cast. The parameter defaults to the previous `string | number` union, so every existing
  `LyraTable<Row>` annotation and untyped usage compiles unchanged.
