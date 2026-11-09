---
'@aceshooting/lyra-map': patch
---

Release map, visibility and canvas observers when scene bridge construction fails during listener registration or input subscription. Failed construction no longer retains callbacks for a bridge the caller never received. Keep releasing the remaining observers and graphics resources when one listener removal throws, preserving the original construction error.

The required cleanup increases the map archive from 1,051,117 to 1,051,147 packed bytes and from 4,295,602 to 4,295,831 unpacked bytes, with the same 677 files. Advance only the exceeded archive ceilings to the next 64-byte boundaries, 1,051,200 and 4,295,872 bytes.

The packed MapLibre consumer, including the scene-report validation and native-control guards, measures 2,525,671 raw bytes across 52 emitted files. Set its raw limit to the next 64-byte boundary, 2,525,696 bytes; retain its existing dependency and file checks.
