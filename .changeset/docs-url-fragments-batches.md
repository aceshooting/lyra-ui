---
"@aceshooting/lyra-docs": minor
---

Add opt-in bounded URL loading, fragment reads and atomic formatting batches. `<lr-docx-editor>.openUrl()` and `fetchDocxBytes()` download a document only when asked: relative, HTTP(S), `blob:` and `data:` URLs pass a scheme check before and after resolution, the response is read with the 16 MiB input ceiling and a chunk ceiling, and newer opens, disconnects and caller signals cancel the request. Failures report the new `fetch-failed` refusal or existing codes and show the localized error state without server messages.

`readFragment()` copies a bounded slice of top-level body blocks (at most 64 blocks and 32,768 text code units per request) with revision-scoped paragraph ids for `selectFragmentBlock()` and batch targets. `applyEdits()` applies 1–32 paragraph and character formatting steps at a required expected revision as one revision and, normally, one undo step; a step the engine refuses reverts the earlier steps, verified against a structural package digest, and is reported by index. Existing APIs are unchanged; `DocxRefusalCode` gains `fetch-failed`.
