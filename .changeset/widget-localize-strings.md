---
"@aceshooting/lyra-ui": minor
---

`lyra-widget`'s collapse/expand, exit-fullscreen/expand-to-fullscreen, and view-toggle-group
aria-labels, plus its fullscreen dialog's fallback accessible name, now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. The collapse/expand labels
reuse `lyra-dock-panel`'s existing `dockPanelCollapse`/`dockPanelExpand` keys. Default English
output is unchanged when no override is set.
