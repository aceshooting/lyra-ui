---
"@aceshooting/lyra-ui": minor
---

`lyra-table`'s `columns[].sticky` option now accepts `'start' | 'end'` in addition to the legacy
`boolean` (`true` continues to mean `'start'`, unchanged). An `'end'`-sticky column pins to the
inline-end edge instead — useful for a trailing actions column that would otherwise be pushed off
a narrow viewport — via the same `inset-inline-*` logical-property approach, so RTL is unaffected.
