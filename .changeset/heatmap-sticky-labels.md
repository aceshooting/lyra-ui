---
"@aceshooting/lyra-ui": minor
---

`<lr-heatmap>` gained `sticky-labels` (`'none' | 'rows' | 'cols' | 'both'`, default `'none'`), which
paints the matrix label bands into their own layers instead of into the scrolling bitmap.

Matrix labels shared one canvas with the cells, so a tall grid lost its column header on scroll: a
160-row matrix at cell-size 32 is about 5,100px of bitmap, and a header baked into it cannot be
`position: sticky` on its own. The only workaround was a light-DOM mirror row, which had to follow
the gutter width and cell size — and before `matrixGeometry` shipped it had to hardcode them, which
made the workaround mutually exclusive with `row-label-width="auto"`: a consumer got the automatic
fit or the sticky header, never both. (Scale on why the gutter matters: against the component's own
10px label font, 160 country names ellipsized 37 times in the built-in 60px gutter and 3 times in a
120px one.)

A closed set rather than a boolean, because a boolean cannot express one axis at all and a later
one-axis need would force either a second property or a breaking type change; and rather than a
`sticky-row-labels`/`sticky-col-labels` pair, which is two attributes and four states for one
concept with no single reflected value to select on in CSS. `rows`/`cols` name the axes this
component already names everywhere else (`rowLabels`, `row-label-width`, `colLabels`,
`col-label-height`), which `freeze-axis="x|y"` would have clashed with.

Default `'none'` reproduces today's single-canvas output exactly, including in calendar mode, and an
unrecognized value normalizes back to `'none'` and repairs the attribute.
