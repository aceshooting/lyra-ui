---
"@aceshooting/lyra-ui": major
---

Relay focus and blur as native FocusEvent objects in the remaining search, editor, dialog, and composite control wrappers. Preserve relatedTarget and suppress duplicate source events; listeners should use native focus fields rather than CustomEvent detail.
