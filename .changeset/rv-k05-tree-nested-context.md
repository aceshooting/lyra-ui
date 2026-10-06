---
"@aceshooting/lyra-ui": patch
---
lr-tree: nested items revealed by a click, a key press or a direct `expanded` write now receive their level, set position, indentation, roving tab stop and multiple-selection checkbox even when nothing awaits the tree's `updateComplete`; initial tri-state selection, selection-mode changes, reorder announcements and focus restoration after a data refresh no longer depend on that await either.
