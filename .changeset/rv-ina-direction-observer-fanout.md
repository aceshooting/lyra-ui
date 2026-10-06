---
"@aceshooting/lyra-ui": patch
---
Re-rendering a container whose shadow root holds many direction-aware components (tooltips, popups, selects, menus, charts) no longer makes every one of them re-resolve its ancestry and computed text direction on each list insert, move or removal: only slot insertions, removals and reassignments re-check it, once per batch of DOM changes.
