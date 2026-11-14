---
'@aceshooting/lyra-ui': patch
---

Preserve the selected PDF page when page measurements or viewport resizing change only the end of the visible range. Scrolling across a page boundary still updates the current page, and moving a loaded viewer within the document retains its navigation and search state.

The fix adds 132 runtime/declaration bytes. The package measures 22,553,257 unpacked bytes; only its exceeded unpacked ceiling advances to the next 64-byte boundary, 22,553,280.

Four aggregate gzip ceilings also advance to the next 64-byte boundary: all.js measures 1,483,154 bytes, autoloader-cdn.js 1,708,567, autoloader.js 1,708,375, and viewers/index.js 461,783. Other bundle ceilings are unchanged.

The installed core consumer measures 5,671,600 raw bytes across 64 emitted files after the virtual-row and PDF navigation fixes. Only its exceeded raw ceiling advances to 5,671,616 bytes, retaining 16 bytes of headroom; gzip and initial-load ceilings remain unchanged.
