---
"@aceshooting/lyra-ui": minor
---

`<lyra-flag>`: added a `detailed` boolean property that requests the pristine, full-detail source SVG
for the minority of flags whose default rendering was recently optimized for icon scale (e.g. `es`,
`pt`, `sv` — see the `@aceshooting/lyra-flags` changeset). A safe no-op for every other flag. Useful
for a flag rendered larger than icon scale (e.g. a hero display) where the extra illustrative detail
is actually visible.
