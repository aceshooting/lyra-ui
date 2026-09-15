---
"@aceshooting/lyra-ui": minor
---

`<lr-document-viewer>` gains two documented sizing hooks directly on the host element:
`--lr-document-viewer-width` forwards straight to the nested `<lr-dialog>`'s own
`--lr-dialog-width`, giving the panel an assertive width without reaching through to the dialog's
own internal custom properties; `--lr-document-viewer-min-height` sets `[part="body"]`'s minimum
block size (default `var(--lr-size-12rem)`, unchanged from before), matching the existing
`--lr-document-viewer-max-height` hook on the same axis.
