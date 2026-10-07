---
"@aceshooting/lyra-ui": patch
---
lr-email-viewer, lr-calendar-viewer, lr-contact-viewer, lr-html-viewer: their `<lr-document-viewer>` renderers now return templates like the other kinds, so the viewer element is created in the document that renders it rather than in the main window's document.
