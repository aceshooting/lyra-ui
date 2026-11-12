---
'@aceshooting/lyra-ui': patch
---

Preserve escaped parentheses and backslashes in unquoted CSS URLs when flattening cascade layers for Happy DOM. Resource paths that resemble layer blocks now remain intact, and following layers still unwrap after the real URL boundary.

Preserve escaped at-signs and braces in selectors, and escaped punctuation in layer names, so they cannot be mistaken for layer directives or block boundaries.

The escape handling adds 95 unpacked bytes: the pnpm archive measures 22,542,246 bytes and the npm dry-run estimate measures 22,542,868 bytes. Raise only the exceeded unpacked ceiling to the next 64-byte boundary, 22,542,912 bytes. Download, file-count, and bundle ceilings remain unchanged.
