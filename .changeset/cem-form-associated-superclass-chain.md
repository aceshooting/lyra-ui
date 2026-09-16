---
"@aceshooting/lyra-ui": patch
---

Fixed `custom-elements.json` silently omitting `value`, `name`, `required`, and `disabled` (as both
members and attributes) for a `FormAssociated` component that inherits the mixin through a
superclass in a different module rather than declaring it directly -- `lr-number-input` and
`lr-native-time-input` (both extend `LyraInput`, which owns the mixin). The
`lr-form-associated-mixin-members` custom-elements-manifest plugin's superclass-chain walk already
found and back-filled these declarations correctly; the gap was that `scripts/manifest-compact.mjs`
runs as a separate pass after `cem analyze` and prunes any member/attribute whose `inheritedFrom`
resolves to an identical entry on the named superclass, which is exactly what the back-filled (and,
for `value`, CEM's own natively-inherited) entries looked like. Both tags now carry the same
member/attribute shapes, types, and defaults as every other `FormAssociated` consumer. Manifest
accuracy only -- runtime behavior was already correct.
