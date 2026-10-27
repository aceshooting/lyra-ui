---
'@aceshooting/lyra-gen': minor
---

Let a subset catalog leave out optional child roles. `LyraGenComponent` gains `optionalChildren`
(a subset of `children`); the built-in `alert` (`text`, `button`), `empty` (`button`) and
`source-card` (`text`) declare theirs, so `subsetCatalog()` accepts `alert` or `empty` without
`button` in a read-only catalog. The unselected role is removed from that parent's allowed children,
so generated content placing it there is rejected by `validateView()`. Required child roles
(`select` to `option`, `source-list` to `source-card`, `chat-viewport` to `chat-message`) still fail
with `catalog.dependency`. The catalog presets document each role's required and optional companions.
