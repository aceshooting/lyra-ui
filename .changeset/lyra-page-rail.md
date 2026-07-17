---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-page-rail>`: a virtualized vertical thumbnail rail for page-addressed documents, with
per-page highlight heat markers. Wired mode (`viewer`/`for`) tracks page/count from a
`PageThumbnailSource`-shaped viewer's own `lyra-load`/`lyra-page-change` events and lazily renders
thumbnails as rows materialize (`lyra-pdf-viewer` satisfies this structurally); mediated mode
(`page-count`/`page`) works as a fully functional pager without a wired viewer. Roving-tabindex
keyboard access via `lyra-virtual-list`, typed-digit page jump, `lyra-page-select` event.
