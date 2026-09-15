---
"@aceshooting/lyra-ui": major
---

`<lr-table>`'s `columns[].priority` column-hiding now reacts to the table's actual measured
overflow instead of two fixed container-width breakpoints.

In 15.0.0, a `'low'`-priority column hid under a fixed ~900px container width and `'medium'` under
~640px, regardless of whether the table's content needed the room — a table narrower than the
threshold lost columns even when nothing overflowed, while a wide table with very long cell content
kept every column and simply grew wider than its container. `scroll-mode="auto"` already measures
real overflow (`scrollWidth` vs `clientWidth`) to decide whether the table becomes its own
horizontal scrollport; `columns[].priority` now shares that same measurement instead of
disagreeing with it. `'low'` still hides first, and `'medium'` hides too only if the table would
still overflow with `'low'` gone — the same progressive order as before, now triggered by genuine
overflow rather than a width threshold. `hasHiddenPriorityColumns`,
`priorityColumnsToggleAvailable`, `priorityColumnsVisible`, and the
`lr-priority-columns-visibility-change` event are unchanged.

The two thresholds remain deliberately non-themeable: a `@container` query, which a token-driven
threshold would need to read, can only ever see ancestor inline-size, never a measured overflow
amount.

**Migration.** A table whose content genuinely doesn't fit its container behaves the same as
before. Affected: a table sized comfortably wider than its content that happened to sit under the
old fixed threshold (e.g. a 700px-wide `<lr-table>` whose columns easily fit in 500px) no longer
hides its priority columns — previously it did, regardless of fit. A table whose content is wide
enough to need the room continues to hide the same tiers in the same order. There is no opt-out:
`table.styles.ts`'s `[part='base'][data-hide-priority-low]`/`-medium` attributes replace the former
`@container` rules and are internal wiring, not selectors a consumer should target directly.
