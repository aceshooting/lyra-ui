---
"@aceshooting/lyra-ui": patch
---

`lr-archive-viewer` no longer binds an untrusted ZIP entry name as a DOM `id` (`renderEntry()` set
`id=${entry.name}`, a classic DOM-clobbering primitive — a crafted archive entry named e.g.
`"body"` or `"documentElement"` could shadow a global DOM property lookup for code elsewhere in the
page). Fragment-anchor resolution (`scrollToAnchor()`'s `'fragment'` kind) now matches the target
row by its rendered `textContent` instead of by `id`, and no longer delegates to the shared
`TextViewerTarget` base's generic `id`-based fragment resolution for this component.
