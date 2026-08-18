---
"@aceshooting/lyra-ui": minor
---

Four more consumer-filed defects, two per component.

**`<lr-table>`: cell links are themeable.** A column's `cell(row)` renders its TemplateResult inside
the component's shadow root, so an anchor it returns is unreachable from page CSS — and `::part()`
cannot select past the first compound selector to reach it either. It computed to the UA default
link blue, the one colour on the page belonging to no design system. Cells now take
`--lr-table-cell-color`, and a cell anchor takes `--lr-table-cell-link-color` (brand by default)
plus `--lr-table-cell-link-hover-color`. `:where()` keeps specificity at zero so an inline style on
the returned anchor still wins, and `revert` hands the UA default back.

**`<lr-table>`: `scroll-mode="page"` makes an uncapped table's sticky header work.** `[part="base"]`
was unconditionally `overflow: auto`, which makes it the sticky containing block for the header
whether or not anything can scroll in it — so with no `--lr-table-max-height` the header scrolled
away with the page, and an uncapped page-scrolling table and a pinned header were mutually
exclusive. That is a real CSS constraint rather than an oversight: a scroll container clips *both*
axes. The fix is therefore an explicit opt-in, not a changed default, since dropping the overflow
unconditionally would cost every uncapped wide table its horizontal scrolling.

**`<lr-map>`: a guarded `maxBounds`.** Calling `map.setMaxBounds()` through the `.map` escape hatch
can wedge maplibre-gl at a sub-1 fractional zoom in a wide container: `getZoom()` returns `null`
permanently, every frame throws from inside the peer's matrix math, and the canvas never paints
again — a blank map, with nothing thrown at the call site. The property applies the same call, reads
the camera back, and reverts if it did not survive, so the worst case is an unconstrained map plus a
dev-mode warning.

**`<lr-map>`: property-only choropleth updates no longer re-tile the whole source.** `setData()`
re-tiles unconditionally, which is invisible on a static map and expensive on an animated one. When
an update changes only feature properties, the component now emits maplibre-gl's incremental
`updateData()`. The fast path requires the same feature count, an addressable `id` per feature, and
geometry that is the *same object* as last time — a deep compare would cost about what the re-tile
costs, and a false positive would paint stale geometry. Anything else falls back to `setData()`.
