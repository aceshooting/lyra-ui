---
"@aceshooting/lyra-ui": major
---
lr-pdf-viewer, lr-pptx-viewer, lr-ebook-viewer, lr-document-viewer: loading now uses the shared visible `spinner` treatment, lr-document-viewer's error text gains an `error` part, and lr-notebook-viewer's idle note matches its siblings. Migration: `pdf-viewer.js` and `pptx-viewer.js` no longer register `lr-skeleton`; import it yourself if you relied on that.
