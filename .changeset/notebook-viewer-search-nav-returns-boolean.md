---
"@aceshooting/lyra-ui": minor
---

`<lr-notebook-viewer>`: `searchNext()` and `searchPrevious()` now resolve `true` when the active
match moved and `false` when there was nothing to move to, matching the shared viewer search
contract (`LyraTextViewerTarget`) that every other searchable viewer already honors. They
previously returned nothing, so a find-in-page host driving several viewers polymorphically —
`if (await viewer.searchNext()) { ... }`, or awaiting the call before reading its own match
counter — got `undefined` from the notebook viewer alone and took its falsy "no more matches"
branch on every press, even mid-notebook.

This is an additive widening: the methods return a resolved promise instead of nothing, and callers
that ignored the return value are unaffected. `search()` already resolved the match count and is
unchanged.
