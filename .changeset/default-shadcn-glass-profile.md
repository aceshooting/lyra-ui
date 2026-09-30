---
'@aceshooting/lyra-ui': major
---

Use Shadcn, Glass, Emerald and System mode as the built-in appearance defaults. First paint, runtime restoration and resets share the same profile while preserving independently saved choices, including explicit Solid surfaces, the Lyra look and cleared accents. `accent: null` remains an explicit clear; `resetLyraStyle()` restores the Emerald default.

Use a 70% opaque Glass fill across navigation, menus, listboxes, dialogs and drawers, with foreground contrast protection. Native application chrome can use `.lr-surface-chrome` from `theme.css`. Scrolling surfaces keep their material stationary, nested surfaces avoid repeated blur, and accessibility preferences retain opaque fills.

Allow `--lr-theme-surface-opacity` to span 0–1 for user-controlled Glass opacity. The default remains 70%; Solid surfaces and increased-contrast or reduced-transparency preferences remain opaque. The design-panel recipe uses the existing slider, the public CSS input and an application preference to save and reset opacity.

Preserve explicit Solid and Glass scopes across nested and promoted surfaces, and keep plain rail and menubar frames transparent. Align form controls across size tiers while preserving custom sizing and wrapping. Keep keyboard focus visible inside clipped panels and image viewports, and restore visible hover feedback in document comparison panes.

Resolve contrast corrections against the selected or inherited look during startup and runtime updates. Preserve the Lyra look's local decorative-border fallback while retaining Shadcn defaults without a theme stylesheet.
