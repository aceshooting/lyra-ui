---
'@aceshooting/lyra-ui': patch
---

Report active PDF and archive transport failures even when they use an AbortError, while keeping canceled requests silent. Resume pending transport after same-task DOM moves, preserve active PDF parsing tasks, and discard late responses from retired requests.

PDF transport ownership adds 82 gzip bytes to its standalone entry, while archive ownership reduces its entry by 13 bytes. The reviewed all-components, autoloader, viewer-family, PDF and SSR bundle ceilings advance only where exceeded, to the next 64-byte boundary. Together with the bootstrap simplifications, the package measures 22,639,805 unpacked bytes in the actual archive and 22,640,427 in the npm dry-run inventory across the same 3,290 files; its unpacked ceiling becomes 22,640,448 bytes. Download, file-count, companion and passing bundle limits remain unchanged.

The installed core bundle measures 5,693,092 raw bytes across 65 files, a 642-byte increase. Its raw ceiling advances to 5,693,120 bytes; gzip limits, optional-peer exclusions and the separate exact binary requirement remain unchanged.
