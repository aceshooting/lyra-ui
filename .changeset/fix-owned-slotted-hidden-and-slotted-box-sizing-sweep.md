---
"@aceshooting/lyra-ui": patch
---

Sweep: a component-owned `hidden` flag on a slotted node now wins over an author `display` rule,
and two slotted-content allocations stop overflowing.

- `<lr-random-content>`: a candidate the rotation has selected out is flagged `hidden` by the
  component itself, but its `::slotted([hidden])` rule was normal-weight. Per CSS Cascade 5's
  shadow-tree encapsulation-context ordering, any author `display` rule matching the candidate in
  its own light-DOM tree already outranked it, so every rotated-out candidate stayed painted and
  the rotation went visually inert while only assistive technology followed the selection. The
  rule now uses `display: none !important`, matching `<lr-multi-split>`'s owned panels,
  `<lr-toast>`'s queued items and `<lr-avatar-group>`'s overflow, which already force their own
  state that way. Author-driven `hidden` elsewhere in the library deliberately stays
  normal-weight, so an author who sets both `hidden` and `display` on their own node still wins.
- `<lr-browser-frame>`: the slotted viewport surface is given `inline-size: 100%`/`block-size: 100%`
  but `box-sizing` does not inherit across the slot boundary, so a surface with its own padding or
  border resolved those as its content box and overflowed `[part="viewport"]` (a block container,
  which cannot shrink it back). It is now `border-box`.
- `<lr-carousel>`: each slide is given a definite, non-shrinking flex basis
  (`flex: 0 0 <slide basis>`), so a padded or bordered slide overran the track and pushed its
  scroll-snap edge past the next slide. Slides are now `border-box`, which also makes a looped
  clone exactly as wide as the slide it copies — clones live in the shadow tree and were already
  `border-box` through the shared reset.
- `<lr-chip-group>`: the overflow collapse writes its own `hidden` on slotted children (that is what
  the "+N" pill stands in for), but the group had no `::slotted([hidden])` rule at all, so any
  normal-weight author `display` rule matching those children re-revealed them next to a pill
  claiming to be standing in for them. A child that is an `lr-*` element was already covered by its
  own `:host([hidden])` reset; this slot documents any content, including plain elements and SVG.
  The forcing rule carves out `hidden="until-found"` so find-in-page can still reveal an author's
  own collapsed child.
- `<lr-timeline>`: `scale="time"` absolutely positions each slotted item at `inline-size: 100%`
  (`calc(100% - lane indent)` under `collision="stack"`), and `box-sizing` does not inherit across
  the slot boundary, so an item with its own padding or border resolved that as its content box and
  overflowed the host — nothing shrinks an absolutely positioned box back. Slotted time-scale items
  are now `border-box`; an `<lr-timeline-item>`, already `border-box` through its own reset, renders
  identically.
- `<lr-dashboard-grid>`: a cell's slotted tile is given `inline-size: 100%`/`max-inline-size: 100%`
  in the same content-box trap. The flex cell already shrank an ordinary padded tile back inside, so
  this changes nothing for one; a tile the author pinned with `flex-shrink: 0` had nothing to absorb
  the overshoot and overran its cell. Tiles are now `border-box`.
