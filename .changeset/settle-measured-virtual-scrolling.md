---
'@aceshooting/lyra-ui': patch
---

Let smooth virtual-list navigation finish before correcting estimated row and group sizes. Intermediate measurements no longer repeatedly restart native scrolling, and measured destinations settle after the animation. New navigation, replacement data, keyboard scrolling and disconnect retire stale corrections; reduced-motion navigation remains immediate.

Measure Window viewports from the document's scrolling root so lists remain virtualized in both standards and quirks mode. Documents without a doctype no longer render the entire collection or misalign distant scroll targets.

The fixes add 808 unpacked package bytes and 146 standalone virtual-list gzip bytes. The package estimate is 22,544,227 bytes and the verified archive is 22,543,605 bytes; advance the exceeded unpacked ceiling to 22,544,256 bytes, with 29 bytes of headroom. Advance only the 13 exceeded gzip ceilings to their next 64-byte boundaries. The complete packed core graph measures 5,667,406 raw bytes across the same 64 files, so its ceiling advances to 5,667,456 bytes, with 50 bytes of headroom.
