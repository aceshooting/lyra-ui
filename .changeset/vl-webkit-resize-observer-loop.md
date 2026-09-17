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
folds each newly measured row height into the offsets and asks for a render; Lit flushes that render
on the microtask checkpoint that follows the observer callback, which is still inside the browser's
resize-observation delivery. Under an external `scrollElement` that write resizes an *observed* box,
because `[part="base"][data-external-scroll]` takes its own block size from the spacer and is watched
by the container `ResizeObserver` -- and `[part="base"]` sits shallower in the tree than the rows
just broadcast, so the browser records the resize as a skipped observation and ends the loop with the
error. Reproduced deterministically in WebKit and, with a large enough first measurement delta, in
Chromium too.

The render, and the scroll-anchor correction that belongs with it, now wait for the animation frame
this component already used to defer `observe()` calls out of the same delivery. Both still land in
that frame together, before its own resize-observation step, so the settled extent, scroll position
and window are the ones they always were; only the frame the DOM write happens in moves. The wait
applies only while an external `scrollElement` is in play, which is exactly when a render of this
component can resize a box it is itself observing: with its own viewport scrolling,
`[part="base"]`'s block size comes from `--lr-virtual-list-height` rather than from the spacer, so
that mode -- and every fixed numeric `row-height` -- keeps the frame timing it has today. The error
message itself is neither suppressed nor filtered anywhere.
