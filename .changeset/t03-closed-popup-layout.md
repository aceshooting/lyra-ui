---
'@aceshooting/lyra-ui': patch
---

Remove the closed lr-menu submenu surface, and the closed lr-model-select and lr-voice-picker listboxes, from layout after their exit transitions, preventing stale popup geometry from creating unwanted scrolling in a container that establishes a positioning context for them.
