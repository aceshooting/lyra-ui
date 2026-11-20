---
"@aceshooting/lyra-ui": patch
---

- `lr-rag-answer` registers `lr-empty` with its own entry, so the empty state upgrades when it is the only import.
- Retrieval components share one `DEFAULT_SCORE_THRESHOLDS` default.
- Roving focus in the memory panel, claim evidence, grounding summary and RAG eval dashboard re-renders only when the focused row changes.
- The 3D graph canvas listens for non-passive wheel events only while focused, so an unfocused canvas no longer blocks page scrolling.
- Memory panel row action names quote a bounded excerpt of the memory text instead of all of it.
