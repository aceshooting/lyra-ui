---
"@aceshooting/lyra-ui": major
---
`lr-subagent-panel` keeps one tab stop (only the focused row's buttons are tabbable), adds ArrowRight/ArrowLeft child/parent navigation, reserves a selection made after mount inside the 500-row cap, and exposes selection as `aria-selected` on the tree item. Migration: read `aria-selected` on `[role="treeitem"]` instead of `aria-pressed` on `[part="run-trigger"]`.
