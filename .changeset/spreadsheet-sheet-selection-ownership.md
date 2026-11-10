---
'@aceshooting/lyra-ui': patch
---

Preserve the latest workbook sheet when a source metadata callback switches sheets. Ignore obsolete dimensions and errors, and cancel navigation belonging to the superseded selection.

Discard column metadata and render errors from superseded sheet callbacks so the latest sheet keeps its own headers and cells.
