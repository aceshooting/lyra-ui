---
"@aceshooting/lyra-ui": patch
---
lr-reorder-list: boundary state is derived in one linear pass instead of an array search per item, and the item observer no longer wakes for attributes it never used; lr-reorder-item writes its role only when it is not already listitem.
