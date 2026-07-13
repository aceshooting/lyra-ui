---
"@aceshooting/lyra-ui": patch
---

`lyra-menu`'s `onListKeyDown` now ignores a keydown whose target isn't a real `<lyra-menu-item>`,
matching the same `instanceof LyraMenuItem` guard `onItemSelect`/`onListFocusIn` already use --
previously it unconditionally intercepted Arrow/Home/End/Enter/Space/Escape/Tab from any keydown
bubbling through `[part="list"]`, including from non-item slotted content (e.g. a custom-range
date input), hijacking keystrokes meant for it. Note: Escape/Tab now also only close the menu when
the event originates from a real item -- a slotted non-item control gets fully default keyboard
behavior instead.
