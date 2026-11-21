---
'@aceshooting/lyra-docs': patch
---

`lr-docx-editor`'s command palette keeps **New** and **Open** available when the document
selection settles after the palette opens, such as a caret that lands late from the click before
Ctrl+K. Those commands replace the whole document, so only selection-bound commands are disabled as
stale, and choosing **Open** reaches the native file picker.
