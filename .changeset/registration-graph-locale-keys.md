---
"@aceshooting/lyra-ui": minor
---

Every `registrations.json` row now carries `localeKeys`: the `LyraMessageKey`s reachable by every tag
that importing it registers. It reuses the reachability walk that already derives the tree-shakeable
default-string slices — including keys a component reaches only through an indirect lookup table,
such as `lr-attachment-trigger`'s per-kind trigger and menu keys — rather than scanning for literal
`localize()` calls. Paired with `getRegisteredLyraLocaleKeys()`, a consumer can now verify that its
locale catalogue covers everything its rendered components can reach entirely from public, generated
metadata, with no parsing of `dist/`. The field is additive, so `schemaVersion` stays `1`.
