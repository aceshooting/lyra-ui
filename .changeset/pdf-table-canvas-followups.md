---
"@aceshooting/lyra-ui": patch
---

Three defects reported against 11.0.0:

- **`<lr-pdf-viewer>` text layer, reopened.** 10.0.0 fixed only half of it. The chunk bounding
  guarded against copying an `undefined` style over a good one, but it also *rebuilt* the style map
  from the fonts of the items retained in that chunk — so a style PDF.js announces ahead of the
  items that use it was dropped and never re-sent. Both failures end the same way: a later lookup
  reads `undefined.vertical` and aborts the rest of the page. Measured by the reporter on a 9-page
  document as 4 affected pages and 101 of 271 spans orphaned. Now every own entry the chunk carries
  is copied and only `undefined` is skipped, so falsy-but-defined styles (`null`, `0`, `''`) still
  survive and an inherited `constructor`/`toString` stays unreachable.

- **`<lr-table>` no longer dies on a column missing its `cell` renderer.** `cell` is typed and
  documented required, but columns arrive through a lit `.columns=${...}` binding, which `tsc` does
  not type-check — so required-ness was unenforced where it is written *and* unguarded at runtime.
  A single malformed column threw out of lit's `repeat`, taking the whole table down with a stack
  naming neither the column nor the table. It now degrades to an empty cell and reports once per
  column, naming the key, the tag and the missing member.

- **The shared scratch canvas is created with `willReadFrequently`.** `<lr-heatmap>`'s colour
  resolution does a 1×1 `getImageData()` readback for any colour the canvas normalizes into a form
  its string parsers reject (`color-mix()`, `oklch()`, `lab()`), which Chrome warns about on every
  page carrying a heatmap. A `color-mix()` ramp takes that readback per cell.
