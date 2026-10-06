---
"@aceshooting/lyra-ui": major
---
lr-pdf-viewer, lr-pptx-viewer, lr-docx-viewer, lr-archive-viewer, lr-notebook-viewer, lr-xml-viewer, lr-document-preview: a same-task DOM move now keeps the loaded document instead of reloading it, and lr-ebook-viewer keeps its book across `moveBefore()`. Migration: teardown after `remove()` now runs a microtask later; await one before expecting the document to be released.
