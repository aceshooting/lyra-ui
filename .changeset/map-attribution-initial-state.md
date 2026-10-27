---
'@aceshooting/lyra-ui': minor
---

Add `controls.attribution.initialExpanded` to `lr-map`, an initial-only seed for the compact credits disclosure, and the non-cancelable `lr-map-attribution-toggle` event (`detail.expanded`), which reports later changes of the owned attribution control without firing on installation, seeding, replacement or reconnect. Requested control outlines now stay in place, decorative and non-interactive, after the map is constructed until those controls finish loading, and paint with the installed controls' glass or solid surface material.

Add the opt-in `keyboardActivation` property (attribute `keyboard-activation`): while the map canvas has focus, an unmodified Enter or Space activates the interactive feature at the view centre through the click hit query and emits `lr-map-click` with `trigger: 'keyboard'`. Add `getVisibleBounds({ padded? })`, a synchronous read of the padded or full visible box that returns `null` before the engine exists.

The attribution state tracking, pending control outlines, keyboard centre activation and visible-bounds reader add runtime code, and their guides and generated editor data increase archive sizes. Only the exceeded media and viewers bundle ceilings, the unpacked UI archive ceiling and the generated IDE archive ceilings advance to the next 64-byte boundary; passing limits and measurement inputs remain unchanged.
