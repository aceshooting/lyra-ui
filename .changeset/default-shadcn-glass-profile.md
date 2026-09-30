---
'@aceshooting/lyra-ui': major
---

Use Shadcn, Glass, Emerald and System mode as the built-in appearance defaults. First paint, runtime restoration and resets share the same profile while preserving independently saved choices, including explicit Solid surfaces, the Lyra look and cleared accents. `accent: null` remains an explicit clear; `resetLyraStyle()` restores the Emerald default.

Share the stronger Glass treatment across navigation, menus, listboxes, dialogs and drawers. Native application chrome can use `.lr-surface-chrome` from `theme.css`. Scrolling surfaces keep their material stationary, nested surfaces avoid repeated blur, and accessibility preferences retain opaque fills.

Preserve explicit Solid and Glass scopes across nested and promoted surfaces, and keep plain rail and menubar frames transparent. Align form controls across size tiers while preserving custom sizing and wrapping. Keep keyboard focus visible inside clipped panels and image viewports, and restore visible hover feedback in document comparison panes.
