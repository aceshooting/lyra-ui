# Changelog

## 25.6.0

### Minor Changes

- 2abd8e5: Add a `pressed` property to buttons so toggle state reaches the native control without placing ARIA toggle attributes on the custom-element host. The property supports true, false and mixed state; existing host `aria-pressed` values remain the fallback when it is unset.

### Patch Changes

- a50faaf: Keep popover disclosure state on the semantic trigger control, including the native control inside a Lyra button with a roving tabindex. Restore authored ARIA when controls change or disconnect, and avoid generated expansion state on generic wrappers or incompatible roles.

## 25.5.0

### Minor Changes

- 8a42ae7: Add `lr-currency-picker`, a form-associated currency selector with localized names and symbols,
  an optional ordered catalog, and a compact ISO-code trigger. The control follows shared keyboard,
  validation, localization and styling contracts without fetching exchange rates or changing the
  page locale. Its opt-in search matches codes, localized names and symbols, and catalogs support
  caller-defined groups. Registration-free currency helpers expose the complete ISO catalog and
  validate, load and convert explicit rate snapshots with caller-owned providers and cancellation.

  Add country, time-zone and measurement-unit pickers with configurable catalogs, optional search,
  native form contracts and consistent field styling. Country choices include localized names and
  decorative flags by default, with an option to hide the flags. Add optional text filtering to the
  language picker while preserving its locale loading, veto and selection behavior.

  Match the form mixin's public reset-default setter type to its existing nullable runtime input,
  while preserving the non-nullable read type and dirty live values. Keep a cleared reset attribute
  absent after the next render instead of restoring an empty attribute through queued reflection.

  Avoid marking selected `lr-select` and `lr-combobox` values as unavailable before their slotted
  options have been collected, including during server rendering. Keep the select dropdown within
  the available screen height and width when text is enlarged, and scroll keyboard-highlighted
  options into view within the listbox. Document the existing rendered `data-value` hooks and `chooseOption()` test driver for
  selecting options by value.

## 25.4.0

### Minor Changes

- 9deeb23: Add the inherited `--lr-avatar-border` CSS border hook for image, glyph and initials avatars. It defaults to no border and keeps the configured outer diameter across shapes and avatar groups, while preserving the forced-colors boundary.
- 9deeb23: Add matrix-only heatmap `rowHeight` / `row-height` to keep readable rows independently of fit-to-width columns, with matching pointer, keyboard, accessibility, frozen labels, and export geometry.
- 9deeb23: Add opt-in `sync-group` coordination between categorical vertical `lr-chart` and `lr-lite-chart` bar and line charts. Pointer and keyboard navigation show each chart's own matching category, crosshair and tooltip while preserving focus, announcements and activation behavior.

### Patch Changes

- Keep the pan-zoom reset button’s screen-reader label inside its button so nested scroll containers do not create extra page overflow. Preserve localized reset names, keyboard activation and visible zoom percentages.
- Contain flag-only locale-picker descriptions within their trigger and browser-frame address labels within their toolbar, preserving accessible text without enlarging outer scroll areas.
- fffbad7: Support KaTeX 0.19 alongside the existing 0.18 range, and preserve complete version ranges in the generated optional-peer documentation.
- 9deeb23: Give reorder-item move controls localized action-label fallbacks for automation tools that omit
  reflected element references, while preserving the full action-and-row native accessible names.
- 9deeb23: Qualify glass control borders from the effective painted opacity, preserving contrast at the default 70% while restoring ordinary border colors on opaque surfaces and nested overlays. Controls inside surface-colored outlined cards and disclosures no longer inherit bright glass border qualification.
- 9deeb23: Keep the app rail resize handle aligned with the navigation edge during width transitions, live sizing changes and reconnection.
- 9deeb23: Keep loading button spinners centered in a glyph-sized box so their rotation does not create overflow or flickering scrollbars in dialogs and scroll containers.

## 25.3.1

### Patch Changes

- 8fa2d03: Give language choices a comfortable 3rem minimum row height independent of compact triggers or density, add roomier block padding, and wrap long native labels while retaining keyboard navigation, RTL and viewport scrolling.
- cc451c6: Clarify that theme.css includes the default Shadcn look and distinguish optional look sheets from legacy mode compatibility aliases.
- 1993c8a: Validate the latest stable syntax-highlighting, math-rendering and email-parsing dependencies while retaining support for the existing Shiki peer range.
- f0212e7: Keep nested menu labels readable on narrow viewports by trying placement above or below the parent when neither side has enough space. Preserve ordinary side placement, RTL navigation, and menubar attachment.

## 25.3.0

### Minor Changes

- ce805a4: Add a property-only `interactionBoundary` to popovers with DOM anchors so presses within a collection can reanchor the open popup without a hide/show cycle.

### Patch Changes

- 8a35c8f: Clarify no-flash bootstrap placement after the document charset declaration and document the current startup fallback profile.
- d7f53a2: Avoid content-name traversal and observation for passive, linked, and explicitly named cards. Refresh the current content-derived name when a card becomes an unnamed action.
- 8a35c8f: Support a validated public documentation base at build time, keeping canonical metadata and crawler files consistent across documentation mirrors.
- 5d3b7c2: Clarify that retrying a locale loader does not guarantee a fresh native module download after a browser-cached failure, and document recovery without losing the current language or unsaved work.
- fbcfd08: Keep locale-picker options at least as tall as a medium control, including label-only language rows and compact flag triggers. Larger text and touch control heights still grow the rows, and long language lists remain scrollable.
- d70a4a4: Give expandable table rows a localized column header for assistive technology while preserving the compact chevron layout and row-specific button names.
- 9a3eaf4: Fix combobox clearing with mouse, touch, and keyboard input so clearing filter text reliably emits `lr-filter` and preserves input focus.

## 25.2.0

### Minor Changes

- a2a7c54: Allow map cluster count labels to use a custom foreground and optional halo so counts remain readable across mixed cluster circle colors. The existing on-tone foreground and halo-free rendering remain the defaults.
- 41e4606: Allow `lr-map` clusters to set an outline color independently from their unclustered points, with theme-aware paint and the existing layer stroke as the default.

### Patch Changes

- a2a7c54: Avoid repeated descriptor validation when traversing the JSON viewer's owned snapshot, while preserving hostile-input admission checks, sparse-array holes, and bounded rendering and search.
- 41e4606: Resolve modern CSS colors and theme expressions before applying map paint, so data layers and choropleths render with MapLibre-compatible colors. Invalid paint falls back to the layer tone.

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
