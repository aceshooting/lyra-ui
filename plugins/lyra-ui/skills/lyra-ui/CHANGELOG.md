# Changelog

## 25.1.0

### Minor Changes

- 94a6d02: Emit `lr-tour-end` with reason `unavailable` when deferred placement fails and the tour closes, so hosts tracking the public lifecycle can clear their open state.

### Patch Changes

- Close the combobox if its positioning runtime fails, even when a host vetoes ordinary dismissal. The failure emits a non-cancelable `lr-hide`; later user-initiated dismissal remains cancelable.
- 8416b39: Keep `lr-data-grid` programmatic row alignment inside its own scrollable body so revealing a row does not move the page or an ancestor scroller.
- 8416b39: Measure data-grid row, group, and expanded-detail heights in layout pixels so ancestor transforms and CSS zoom do not corrupt virtual scrolling. Correct subpixel scroll rounding for rendered and virtual rows so zoomed rows reach their requested viewport edge.
- 8416b39: Keep map legend spacing aligned with native controls when an ancestor scales or zooms the map.
- cfa77b8: Align virtual-list rows to the content viewport of a bordered external scroll element. Programmatic start, end, and nearest scrolling now account for the scroller's block-start border.

  Remove redundant hex parsing from syntax-theme detection while preserving the browser's resolved CSS color behavior.
- 8416b39: Align virtual-list rows correctly when an external scroll element or the list has a positive CSS scale or zoom. Start, end, and nearest scrolling now convert rendered geometry to list and scroll coordinates, including fractional borders and Window scrollers.

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

- Handle map style failures after rendering and discard obsolete work when the style or connection changes.
- Honor the current disabled and read-only state before submitting a completed OTP value.
- Refresh knowledge-base error content when an existing child's slot assignment changes.
- Cancel obsolete text previews before rendering a changed format or loading status.
- Announce asynchronously rendered chat messages across window realms, including adopted custom elements.
- Refresh document-library error content when an existing child's slot assignment changes.
- Preserve tall content inside vertically constrained scrollers instead of shrinking slotted items to the viewport.
- Reset a collapsed map legend's scroll position so its Glass layer cannot retain an empty scroll range; preserve focus and expanded scrolling.
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
