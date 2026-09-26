---
'@aceshooting/lyra-ui': minor
---

`lr-app-rail` gains app-sidebar options: `frame` (floating `card` or edgeless `plain`), a mode-aware `toggle()`, `trigger-collapses` for external trigger ARIA in every mode, and an opt-in `hotkey`. It composes with `lr-page` for an allocation-based drawer.

`lr-app-rail-item` hides its nested disclosure and list while icon-only, preserving `expanded` and recovering focus to the visible parent. `end` content remains visible and requires sufficient compact rail width.

`toggleCollapse()` now alternates the recorded preference while `forceMode` pins presentation. Collapsing a focused resizer returns focus to the rail. `lr-button` and `lr-icon-button` forward host `aria-keyshortcuts` to their native control.

`lr-command-palette` safely ignores key-less autofill events and removed hotkeys, supports non-Latin keyboard layouts through physical key fallback, and shares chord ownership with rails.
