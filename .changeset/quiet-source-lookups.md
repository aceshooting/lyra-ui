---
'@aceshooting/lyra-ui': patch
---

Prevent indexed and ranged data operations from invoking providers retired while their capabilities are being read. Replacing the source or disconnecting its host stops obsolete row and key callbacks before they run. Superseded binding and range work also stops before inspecting more capabilities or consuming replacement pages, while subsequent requests can use the current source normally.

The complete provider ownership checks measure 22,539,040 unpacked UI bytes; the exceeded package ceiling advances to 22,539,072 bytes. Eleven exceeded direct and aggregate gzip ceilings advance only to the next 64-byte boundary above the exact measurements recorded in the bundle budgets. The guards prevent obsolete callbacks and replacement-page loss; measurement inputs, optional-peer exclusions and passing limits remain fixed.

The packed core consumer measures 5,666,569 raw bytes across the same 64 files, an increase of 716 bytes from the initial lookup fix. Its exceeded ceiling advances to 5,666,624 bytes, the next 64-byte boundary. The explicit Oniguruma binary requirement remains unchanged.
