---
"@aceshooting/lyra-ui": minor
---

`<lr-multi-split>`: semantic collapse methods, a releasable pin, focus relocation, and a
floating-drawer inset hook.

- New `expandPane()`, `collapsePane()` and `togglePane()` methods. Each picks the mechanism the
  collapsing pane's **current band** actually provides, so a consumer-built trigger no longer has
  to branch on `collapseState` itself: inside the `floatBreakpoint` band the mechanism is the
  overlay drawer (`open`), above it the mechanism is the `collapseState` pin (`'wide'` for
  expanded, `'rail'` for collapsed). `togglePane()` reads the pane's current presentation —
  `'wide'` counts as expanded, `'rail'` as collapsed, `'floating'` as expanded exactly while
  `open` — so toggling a pane pinned to `'rail'` while the container has narrowed into the
  floating band opens the drawer rather than doing nothing visible. All three are no-ops while
  `collapse="none"` or fewer than two panels exist, they never create a pin the band already
  produces, and a pin they cancel is released rather than replaced, so an expand/collapse cycle
  leaves automatic breakpoint tracking exactly as it found it. They emit no `lr-toggle`, matching
  the existing rule that a direct `open` write does not.
  They are named `…Pane()` rather than `expand()`/`collapse()`/`toggle()` because `collapse` is
  already this component's pane-selection property (`'start'`/`'end'`/`'none'`) and a method
  cannot share that name; the suffixed trio follows `<lr-page>`'s `showNavigation()` precedent.
  **No trigger UI is rendered** — the component still renders no collapsed UI of its own.
- New opt-in `releasePinOnBreakpoint` (attribute `release-pin-on-breakpoint`, default `false`,
  unchanged behaviour when unset). With it set, a pinned `collapseState` releases itself — exactly
  as if `'auto'` had been assigned — when the measured collapse band changes to a different one
  than the pin was made in, or when `effectiveOrientation` crosses `orientationBreakpoint`.
  Re-measuring the same band never releases a pin, so ordinary resizing inside one band leaves it
  alone. Previously a pin survived every band and orientation change until a consumer wrote
  `'auto'` by hand from an `lr-multi-split-collapse-change`/`lr-multi-split-orientation-change`
  listener, which is what made a pin meant for one layout leak into the next.
- Focus is now moved out of a pane a collapse transition stops presenting: `'rail'` (clamped and
  clipped) and `'floating'` while closed (hidden outright). Focus lands on the first surviving
  pane that can take it, otherwise on the split's own divider, and focus anywhere other than the
  collapsing pane is left strictly alone. Previously focus stayed on a control that had just been
  clipped away, or was dropped to the document body when the drawer closed. The open floating
  drawer is unchanged — the overlay manager already owns focus there.
- New `--lr-multi-split-floating-panel-inset` (default `0`): the `'floating'` drawer's distance
  from `[part="base"]`'s edges, applied to both block insets and to whichever logical inline edge
  `collapse` anchors the drawer to, so one declaration insets all three anchored edges. Unset, the
  drawer stays flush with its container exactly as before.
