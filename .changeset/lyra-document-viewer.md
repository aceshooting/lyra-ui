---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-document-viewer>`, a dialog-hosted, format-dispatching document viewer, plus a
`registerDocumentRenderer()` registry for plugging in per-format renderers. Files without a
registered renderer fall back to the existing `<lyra-document-preview>` component.
