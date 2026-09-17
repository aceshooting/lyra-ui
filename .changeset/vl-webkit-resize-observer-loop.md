---
"@aceshooting/lyra-ui": patch
---

`<lr-virtual-list>`: `row-height="auto"` driven by an external `scrollElement` no longer raises the
uncaught window error "ResizeObserver loop completed with undelivered notifications." when the
scroller jumps to its end and the newly revealed window measures. Nothing was ever dropped -- the
browser re-delivers on the following frame -- but the notice arrives as an uncaught `ErrorEvent` on
`window`, so it landed on whatever was running at the time and failed consumers' clean-console e2e
gates with a message that named no component.

The offending write is `[part="spacer"]`'s height, the list's whole virtual extent. `onRowsResized()`
folded each newly measured row height into the offsets and asked for a render; Lit flushes that
render on the microtask checkpoint that follows the observer callback, which is still inside the
browser's resize-observation delivery. Under an external `scrollElement` that write resizes an
*observed* box, because `[part="base"][data-external-scroll]` takes its own block size from the
spacer and is watched by the container `ResizeObserver` -- and `[part="base"]` sits shallower in the
tree than the rows just broadcast, so the browser records the resize as a skipped observation and
ends the loop with the error. Reproduced deterministically in WebKit and, with a large enough first
measurement delta, in Chromium too.

Reading inside the delivery is fine; folding the result into the offsets is what resizes the box.
So the measurement callbacks now only stash what they observed, and the offsets rebuild -- with the
scroll-anchor correction that belongs to it, so neither is ever painted without the other -- runs on
the animation frame this component already used to defer `observe()` calls out of the same delivery.
A render that still lands mid-delivery then re-reads offsets nothing has changed and writes the
extent already in the DOM, which resizes nothing. Renders themselves are never held: this element's
`updateComplete` keeps settling in the same microtask run as before, which is what every component
composing it relies on when it reads rendered rows back after its own update. Only the
external-`scrollElement` case defers at all -- with the list's own viewport scrolling,
`[part="base"]` takes its block size from `--lr-virtual-list-height` rather than from the spacer, so
the extent write reaches no observed box and every measurement there stays as immediate as it was,
fixed numeric `row-height` included. The error message itself is neither suppressed nor filtered
anywhere.
