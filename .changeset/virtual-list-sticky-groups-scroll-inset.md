---
"@aceshooting/lyra-ui": patch
---

Keep `lr-virtual-list`'s scroll-into-view clear of the sticky group band. With `renderStickyGroup`
set, the band's measured height is applied as `scroll-padding-block-start` on the scroll container —
so native keyboard and anchor scrolling get the same treatment — and subtracted from the
top-aligned targets `active-id` and `scrollToIndex({ align: 'start' })` compute, which otherwise
parked the target row underneath the band. `align: 'end'` is unaffected, since the band never
covers the viewport's bottom edge. With `renderStickyGroup` unset the inset is zero and both scroll
paths behave exactly as before, with no inline style on the container at all.
