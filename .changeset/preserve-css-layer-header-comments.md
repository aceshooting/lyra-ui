---
'@aceshooting/lyra-ui': patch
---

Preserve valid CSS when the Happy DOM cascade-layer shim encounters punctuation inside layer-header comments. Block headers and layer-order statements now skip complete comment tokens before locating their actual boundary, and an unfinished header comment leaves preceding rules intact.

The parser fix adds 78 unpacked package bytes, measuring 22,542,773 bytes. Raise only the exceeded unpacked ceiling to the next 64-byte boundary, 22,542,784 bytes; download, file-count, and bundle ceilings remain unchanged.
