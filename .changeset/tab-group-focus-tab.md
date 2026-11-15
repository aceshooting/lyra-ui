---
'@aceshooting/lyra-ui': minor
---

Add `focusTab(name, options?)` to `lr-tab-group`, which moves keyboard focus and the roving tab stop to the named enabled tab's real button, and forward `lr-tab.focus()`/`blur()` to that button. Under the default `activation="auto"` focusing an unselected tab also selects it as `show()` does; under `manual` only focus moves. Disabled, inert and unknown tabs are left alone.
