---
"@aceshooting/lyra-ui": patch
---

`lr-icon-button`: restore rendering for slotted bare SVG geometry (`<path>`, `<circle>`, etc. with
no enclosing `<svg>`) when `icon` is unset. 5.2.0's natural-aspect-ratio change made the default
slot a sibling of the internal glyph instead of nesting it inside an SVG, which silently stopped
this narrow case from painting (no console error, no type error). A small whitelist of raw SVG
geometry tag names is now cloned into a real SVG-namespaced element the same way `<lr-icon>`'s own
custom-content slot already does — every other case (complete `<svg>`, `<img>`, custom elements) is
untouched, so the `createElementNS`-on-custom-elements bug 5.2.0 fixed for `<lr-flag>` cannot
regress.
