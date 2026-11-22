---
'@aceshooting/lyra-ui': major
---

`lr-table`: the `lr-page-change` detail type now declares `pageSize` and `offset` as required,
`Readonly<{ page: number; pageSize: number; offset: number }>`, matching `lr-before-page-change` and
`lr-pagination`. The runtime already sent both fields, so listeners are unaffected and can drop any
fallback for the two fields. Migration: code that builds this detail itself (test mocks, `dispatchEvent`, typed
event-map stubs) must now include `pageSize` and `offset` (`offset` is `(page - 1) * pageSize`);
TypeScript reports every such site.
