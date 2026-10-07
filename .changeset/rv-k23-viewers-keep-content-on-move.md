---
"@aceshooting/lyra-ui": major
---
lr-csv-viewer, lr-dataset-viewer, lr-spreadsheet-viewer, lr-email-viewer, lr-html-viewer, lr-svg-viewer, lr-calendar-viewer, lr-contact-viewer, lr-include: a same-task DOM move now keeps the loaded content instead of fetching and parsing it again, and lr-include no longer re-emits `lr-load` for a move. Migration: teardown after `remove()` now runs a microtask later; await one before expecting the content to be released.
