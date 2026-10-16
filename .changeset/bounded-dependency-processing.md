---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-map': minor
'@aceshooting/lyra-docs': patch
---

Refresh dependency resolutions and security overrides, and bound nested pattern processing and numeric formatting in development dependencies with verified patches. The dependency upgrade command now refreshes transitive dependencies, and CI checks patch integrity and new audit findings.

Update the map renderer's GeoJSON tiling dependency, including its optional `worldCoordinates` option and clipping fixes.

Refresh the document editor's bundled numeric parsing dependency for corrected nonnumeric and leading-zero handling.
