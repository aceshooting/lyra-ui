---
"@aceshooting/lyra-ui": patch
---

Give `<lr-widget>`'s collapse-button `aria-label` its own dedicated locale keys,
`widgetCollapse`/`widgetExpand`, instead of borrowing `<lr-dock-panel>`'s `dockPanelCollapse`/
`dockPanelExpand`. Default English strings are unchanged ("Collapse panel"/"Expand panel"). If you
had registered a locale under the old borrowed `dockPanel*` keys specifically to translate
`<lr-widget>`'s collapse button, move that override to `widgetCollapse`/`widgetExpand` —
`<lr-dock-panel>`'s own keys and behavior are unaffected.
