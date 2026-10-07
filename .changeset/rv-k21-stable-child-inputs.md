---
"@aceshooting/lyra-ui": patch
---
lr-retrieval-trace, lr-provenance-panel, lr-grounding-summary, lr-rag-answer, lr-knowledge-base, lr-rag-eval-dashboard and lr-retrieval-results hand their child components the same input arrays across unrelated updates, so a streamed answer or a section toggle no longer re-projects, re-sorts or redraws them.
