---
"@aceshooting/lyra-ui": patch
---
lr-retrieval-results and lr-retrieval-trace render chunk and stage metadata through the bounded formatter (at most 32 entries, long arrays and cycles truncated); lr-retrieval-search shows an ellipsis, not "The value is invalid.", for a merely truncated filter value.
