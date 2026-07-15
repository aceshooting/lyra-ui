---
"@aceshooting/lyra-ui": minor
---

`lyra-file-input` now forwards host accessible names to its dropzone and file input, exposes an
imperative focus target, reports explicit enabled/disabled ARIA state, and announces accepted and
rejected file counts with correct singular and plural messages.

`lyra-export-button` now forwards host accessible names to its trigger, exposes native focus and
blur methods, and keeps long format menus within the positioned overlay's available space.

`lyra-document-preview` now supports explicit image alternative text (including `alt=""` for
decorative previews), aborts superseded text fetches, and documents its sizing, font, and spinner
motion custom properties.
