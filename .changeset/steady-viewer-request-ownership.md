---
'@aceshooting/lyra-ui': patch
---

Resume pending contact, calendar, HTML, SVG, and XML document loads after a same-task DOM move while preserving already-loaded content. Report unexpected failures named AbortError with localized feedback, and keep requests cancelled by replacement or disconnect silent.

Request ownership and pending-load recovery add 149–194 gzip bytes to the five exceeded viewer-containing bundles. Their ceilings advance only to the next 64-byte boundary: all components 1,488,704 bytes, CDN autoloader 1,714,176 bytes, autoloader 1,713,984 bytes, viewers barrel 463,168 bytes, and SSR all components 1,735,744 bytes. The npm dry-run estimate measures 22,639,711 unpacked bytes across 3,290 files; only the exceeded unpacked ceiling advances to 22,639,744 bytes. Passing limits and measurement inputs remain unchanged.

The complete packed core graph measures 5,692,450 raw bytes across 65 files: 800 bytes from these viewer fixes and 26 bytes from the preceding icon ownership fix above the prior reviewed measurement. Its exceeded raw ceiling advances to 5,692,480 bytes, leaving 30 bytes of headroom. Gzip limits, optional-peer exclusions and binary requirements are unchanged.
