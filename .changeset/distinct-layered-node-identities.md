---
'@aceshooting/lyra-ui': patch
---

Keep layered graph and flow layouts stable for arbitrary unique string node IDs. Distinct edge endpoints no longer collide when IDs contain null characters, and synthetic ordering waypoints cannot share identities with caller nodes. Renaming node IDs preserves geometry, layer assignments and waypoint counts.

The identity fix adds small shared graph/flow entry increases. Four exceeded bundle ceilings advance only to the next 64-byte boundary above their measured sizes; passing limits stay unchanged.
The packed graph consumer measures 460,621 raw bytes across the same 14 files, so its exceeded ceiling advances to 460,672 bytes.
