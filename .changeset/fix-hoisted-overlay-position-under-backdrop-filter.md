---
"@aceshooting/lyra-ui": patch
---

Fixes a WebKit-only positioning bug affecting every hoisted overlay (`<lr-select hoist>`,
`<lr-dropdown hoist>`, `<lr-combobox>`, `<lr-popover>`, `<lr-tooltip hoist>`,
`<lr-color-picker>`, `<lr-date-input>`, and any other consumer of the shared positioner's default
`fixed` strategy): when an ancestor of the trigger had `backdrop-filter` or `filter` applied, the
hoisted popup could render hundreds to well over a thousand pixels away from its trigger —
unreachable by pointer or keyboard, and often entirely off-screen — while Chromium and Firefox
positioned the same markup correctly. The popup's own `left`/`top` ended up computed against the
viewport, then the browser resolved them a second time against the filtered ancestor's box,
because current WebKit (unlike older Safari/WebKitGTK builds) now treats `backdrop-filter`/
`filter` as establishing a containing block for `position: fixed` descendants, matching Chromium
and Firefox's existing behavior — a case the underlying positioning library's own containing-block
detection still explicitly excludes on WebKit. The shared positioner now detects that ancestor
itself and positions against it, so every hoisted overlay lands next to its trigger in all three
engines.
