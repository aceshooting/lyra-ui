---
"@aceshooting/lyra-ui": patch
---

Keep keyboard navigation and option activation in `lr-combobox` aligned with the rows shown in the popup. When only a loading or error message is visible, Enter can still commit typed text in `commit="text"` mode. Server searches that keep their options on screen continue to support keyboard selection.

The full server-rendering entry includes this keyboard handling and measures 1,882,243 gzip bytes, 11 bytes above its previous reviewed measurement. Its size ceiling advances to the next 64-byte boundary.
