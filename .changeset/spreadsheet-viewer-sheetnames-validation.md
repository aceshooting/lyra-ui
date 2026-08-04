---
"@aceshooting/lyra-ui": patch
---

`lr-spreadsheet-viewer` now validates that the optional `xlsx` peer's parsed `workbook.SheetNames`
is actually an array of strings before using it, instead of trusting an unchecked type assertion.
A malformed shape (a real risk here, since the workbook is parsed from consumer-supplied,
untrusted `src` content) now surfaces the standard localized load-failure state instead of silently
producing corrupted sheet tabs.
