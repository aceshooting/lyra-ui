---
"@aceshooting/lyra-ui": patch
---

`<lr-table>` no longer discards a column width that a `lr-column-resize` listener applied for
itself while vetoing the proposed one.

Both committed resizes — the keyboard step on `[part="resize-handle"]` and the drag-end commit —
apply the new width optimistically, dispatch the cancelable `lr-column-resize`, and roll the width
back when a listener calls `preventDefault()`. That rollback is a write that lands *after* the
synchronous dispatch, so it also overwrote a width the listener had just resolved for itself from
inside that same dispatch (refusing the proposed step and driving the handle to the width it
actually wanted), leaving the column on the stale pre-dispatch width instead. A veto now rolls back
only a width that nothing else replaced during the dispatch; a veto that writes nothing still
restores the previously committed width exactly as before, including when that width differs from
the one originally declared on the column.

The distinction is tracked as "did a write happen", not as a before/after width comparison, so a
listener that re-applies the width the column already carried is honoured rather than read as
having touched nothing.
