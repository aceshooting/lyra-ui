---
"@aceshooting/lyra-ui": patch
---

`<lr-ebook-viewer>` no longer lets epub.js register a window `unload` listener. epub.js adds one for every rendition and never removes it, so each closed book stayed reachable from the window, and browsers that disallow `unload` by default (Chromium 158 and later) logged a permissions-policy violation on every render. The viewer already releases its rendition and book when it disconnects; scroll, resize and page snapping are unchanged.
