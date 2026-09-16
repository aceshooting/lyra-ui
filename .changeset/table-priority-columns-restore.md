---
"@aceshooting/lyra-ui": patch
---

`<lr-table>` no longer gets stuck with `priority`-hidden columns after the table widens back out.
Narrowing correctly hid `low`/`medium` columns once their content actually overflowed, but widening
never restored them: `recomputeHiddenPriorityColumns()` reconstructed "how wide would everything be"
by adding a hidden tier's cached natural width to `[part='base']`'s CURRENT `scrollWidth` — and once a
tier was hidden, `[part='table']`'s own `inline-size: 100%` stretched the remaining columns to fill
any leftover room, so that `scrollWidth` tracked `clientWidth` instead of the remaining content's real
width. The reconstructed total then chased whatever the container currently measured rather than the
actual content, so `overflowAtFull` never dropped enough to re-admit a hidden tier — `reload` or
`priorityColumnsVisible = true` were the only ways back, because both bypass the measurement entirely.

The fully-visible width is now reconstructed from three independently cached natural widths (the
always-visible columns, plus each hidden tier) instead of from the currently-rendered, potentially
stretched `scrollWidth`. Every cache is refreshed only on a pass where the table is genuinely too wide
for its container — the one condition under which nothing rendered has spare room to stretch into, and
necessarily true on the pass that first decides to hide anything — so a widening container now
correctly restores every tier that fits, without the restored tier immediately re-hiding on the very
next measurement pass its own restoration triggers.
