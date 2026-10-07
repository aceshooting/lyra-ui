---
"@aceshooting/lyra-ui": patch
---
lr-email-viewer, lr-html-viewer, lr-include, lr-svg-viewer, lr-spreadsheet-viewer, lr-calendar-viewer: optional peers now load through the shared loader, so a failed import is retried on next use instead of being remembered for the page, missing-peer warnings are development-only, and lr-email-viewer loads its two peers in parallel.
