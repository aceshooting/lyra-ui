---
"@aceshooting/lyra-ui": major
---
lr-document-library: only a selection change the user makes announces the selected count; assigning `selectedDocumentIds` (including a controlled parent binding back each `lr-selection-change`) is silent, re-assigning the same `documents`/`selectedDocumentIds`/`tagFilter` array is no change, and `documents` reads return one stable snapshot. Migration: announce programmatic selection changes yourself if you relied on them.
