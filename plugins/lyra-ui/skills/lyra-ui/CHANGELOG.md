# Changelog

## 25.0.0

### Major Changes

- ad64381: Use Shadcn, Glass, Emerald and System mode as the built-in appearance defaults. First paint, runtime restoration and resets share the same profile while preserving independently saved choices, including explicit Solid surfaces, the Lyra look and cleared accents. `accent: null` remains an explicit clear; `resetLyraStyle()` restores the Emerald default.

  Use a 70% opaque Glass fill across navigation, menus, listboxes, dialogs and drawers, with foreground contrast protection. Native application chrome can use `.lr-surface-chrome` from `theme.css`. Scrolling surfaces keep their material stationary, nested surfaces avoid repeated blur, and accessibility preferences retain opaque fills.

  Allow `--lr-theme-surface-opacity` to span 0–1 for user-controlled Glass opacity. The default remains 70%; Solid surfaces and increased-contrast or reduced-transparency preferences remain opaque. The design-panel recipe uses the existing slider, the public CSS input and an application preference to save and reset opacity.

  Preserve explicit Solid and Glass scopes across nested and promoted surfaces, and keep plain rail and menubar frames transparent. Align form controls across size tiers while preserving custom sizing and wrapping. Keep keyboard focus visible inside clipped panels and image viewports, and restore visible hover feedback in document comparison panes.

  Resolve contrast corrections against the selected or inherited look during startup and runtime updates. Preserve the Lyra look's local decorative-border fallback while retaining Shadcn defaults without a theme stylesheet.

### Minor Changes

- d839991: Add `--lr-gemstone-selected-animation` to disable the selected gemstone shine independently while preserving its static halo. The inherited hook works in gemstone swatch pickers and external glyphs, preserves the default loop when unset, and respects application and OS reduced motion.

### Patch Changes

- 29ef483: Keep locale-picker language menus within the viewport when text is enlarged by capping their minimum width by the existing viewport limit.
- 57d8360: Declare cascade layer order in the signature starter so bundled styles preserve the selected look and accent, and include the supported refresh glyph in the icon reference.
- ad64381: Apply the shared Glass treatment to map navigation, scale, attribution and legends. Solid and
  accessibility preferences retain opaque surfaces, and scrolling legends keep their material
  stationary without changing native peer controls or map data colors.

  Defer resize-observer control measurements to the next animation frame so adjusting a legend's
  available space cannot interrupt the same resize notification cycle. Cancel pending measurements
  when the map disconnects or changes containers.
- 3023260: Keep locale loading Retry reachable beside an open locale picker popup, including top-layer popups. The popup places outside failure guidance while preserving the previous selection until loading succeeds.
- 6825826: Reveal the complete keyboard-focused swatch in scrolling single-row palettes, including after item updates.

Older major versions: [release history archive](https://github.com/aceshooting/lyra-ui/tree/main/docs/changelog).
