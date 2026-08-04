---
"@aceshooting/lyra-ui": patch
---

Harden three more components against untrusted values reaching a CSS sink unvalidated (same class
of fix as the earlier ANSI-color/`align`/`open-link` hardening):

- `lr-selection-toolbar` computed its floating position directly from a caller-supplied `rect`
  (`DOMRectReadOnly | null`, but nothing enforces that shape at runtime) into a `styleMap()`-bound
  custom property. A non-finite or non-numeric `left`/`top`/`width`/`bottom` could produce `NaNpx`
  or, since `styleMap()`'s first commit serializes the whole `style` value as one string, break out
  of the declaration. Both `coordinates()` and `updateToolbarPosition()` now coerce `rect` through a
  shared `safeRect()` helper before use.
- `lr-data-grid`'s `columnStyle()` wrote a column's `width` into a `--column-authored-width` custom
  property with no numeric guard, unlike the sibling `gridTemplate` getter's own `Number.isFinite`
  check for the same field — inconsistent, and reachable by the same first-commit `styleMap()`
  string-injection class of bug above.
- `lr-entity-card`'s data-driven type-badge color only rejected `;`/`{`/`}` structural characters,
  not `url(...)`, unlike every other color sink in this library. Now routed through the shared
  `sanitizeCssColor()` helper.
