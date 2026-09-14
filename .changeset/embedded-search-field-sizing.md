---
"@aceshooting/lyra-ui": minor
---

Nine components that embed a search or filter field of their own can now be told what size that
field should be. Until now each one shipped a single fixed geometry — one padding, one corner
radius, and whatever text size it happened to inherit — with no property and no custom property
that reached it, so a built-in filter box could not be lined up with the themed search field
sitting next to it. `<lr-table>`, `<lr-data-grid>` and `<lr-knowledge-graph-explorer>` still
render their built-in search field at a fixed size; they are not covered by this release.

`<lr-thread-list>` gains an opt-in `size` on the library's one six-step ladder
(`2xs`/`xs`/`s`/`m`/`l`/`xl`, plus the `small`/`medium`/`large` spellings, accepted as authored
rather than rewritten). A tier gives the built-in search field the row height, text size, gutters
and corner radius an `<lr-input>` of that tier has. Unsupported values normalize to the omitted
state and remove the attribute. It also gains `--lr-thread-list-search-padding`,
`-search-gap`, `-search-min-height`, `-search-font-size`, `-search-padding-inline`,
`-search-padding-block`, `-search-radius` and `-search-clear-size`, each of which wins over the
tier, so a consumer can take the tier and then move one value.

Two things deliberately do not follow the tier here: the gutter around the field, which is
sidebar chrome rather than field density, and the clear button, whose box is a tap target bounded
by the shared minimum target size rather than by the text scale. Both have their own custom
properties instead.

The same capability now exists on the five siblings whose field is a native `<input>`, each with
today's values as the defaults so unset markup renders byte for byte what it rendered before:

- `<lr-command-palette>`: `--lr-command-palette-search-padding`, `-search-gap`,
  `-search-min-height`, `-search-font-size`.
- `<lr-emoji-picker>`: `--lr-emoji-picker-search-min-height`, `-search-font-size`,
  `-search-padding-inline`, `-search-padding-block`. Its existing `size` still scales only the
  emoji glyph and item box, as documented — it has never tracked the form-control ladder, and
  pulling the filter field along would have resized a surface nobody asked to move.
- `<lr-eval-dataset>` and `<lr-tool-select-dialog>`:
  `--lr-<tag>-search-min-height`, `-search-font-size`, `-search-padding-inline`,
  `-search-padding-block`, `-search-radius`. The trailing gutter stays reserved for the overlaid
  clear button and is not a knob.
- `<lr-node-palette>`: the same five, with the height knob able only to raise the field — the
  shared tappable-target minimum stays underneath it, so no tier can shrink the field past the
  WCAG floor.

`<lr-document-library>`, `<lr-source-picker>` and `<lr-retrieval-search>` could not be fixed with
custom properties at all: their fields are composed `<lr-input>`/`<lr-combobox>`/`<lr-segmented>`
elements that resolve their tier inside their own shadow roots. All three therefore gain an opt-in
`size` that is forwarded to every control they compose — for the retrieval row that means the query field, the mode selector
and the submit button together, because sizing one of three controls on a shared baseline is
exactly what makes a row ragged. The retrieval submit button also gains
`--lr-retrieval-search-submit-min-height` and keeps the tappable-target floor at every tier, so the
smallest tiers cannot shrink it below the WCAG minimum. With no `size`, every composed control
keeps its own `m` default.
