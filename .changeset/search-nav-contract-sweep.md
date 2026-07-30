---
"@aceshooting/lyra-ui": minor
---

`<lr-xml-viewer>`, `<lr-av-player>`, and `<lr-terminal>` now resolve a boolean from `searchNext()`
and `searchPrevious()`, matching the shared `LyraTextViewerTarget` search contract that
`search()` already followed on all three. They returned `void`, so a host driving several
searchable components through that one typed surface — `if (await viewer.searchNext())` — read
`undefined` and took the "nothing to move to" branch on every press.
