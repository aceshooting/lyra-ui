---
"@aceshooting/lyra-ui": minor
---

Add `fitTo="container"` to `<lr-graph>` and `<lr-knowledge-graph-explorer>`, so a force graph can
follow the box it is rendered into instead of a number it has to be told.

`width`/`height` are numbers describing a drawing space, and the SVG is `inline-size: 100%;
block-size: 100%` with `viewBox="0 0 width height"` and no `preserveAspectRatio` override. Any gap
between those numbers and the real pane therefore scaled and letterboxed the whole drawing, and the
layout centred on the wrong midpoint (`forceCenter(width / 2, height / 2)`) — library defaults of
`800`/`600` draw at 512x384 inside a 1039x384 pane, using barely half of it. Filling a responsive
card is the ordinary case for a force graph, so the only way out was to hand-roll a host-side
`ResizeObserver`, a hysteresis threshold so sub-pixel resizes did not thrash, a hard-coded fallback
width for the frames before the first measurement, and a re-render per resize. Through the explorer
it was worse: the graph pane's real height is the reservation minus whatever the toolbar, search
results, pinned row and path strip take, which is not derivable from the public API at all.

The new `fitTo` property (attribute `fit-to`, values `'none' | 'container'`, default `'none'`)
measures the host's own content box and drives the `viewBox`, the layout's centring force,
`focusNode()`/`fit()`'s camera math and the loading skeleton from that measurement. Measuring is
synchronous and happens before the first paint (the host's own height is applied first, so the
measurement is never one frame of a stale box), so the first painted frame is already the right
size rather than an 800x600 frame corrected a moment later; every later measurement arrives on the
existing host-resize watcher (already frame-coalesced) and is rounded to whole CSS pixels, so
sub-pixel jitter changes nothing. A resize re-centres the running layout in place — `forceCenter`
plus a low-alpha restart — and never rebuilds the simulation, so settled node positions, pins and
an in-flight drag all survive. It works in both renderers and across a renderer switch.

`fitTo` does not change how the host itself is sized: an outer `block-size`,
`--lr-canvas-reserved-height` and `height` still do that, and `'container'` simply follows whichever
of them won. `fitTo` defaults to `'none'`, where the numeric `width`/`height` remain the explicit
drawing space exactly as before, so nothing changes for existing usage. `<lr-knowledge-graph-
explorer>` gains the same property and forwards it, which is what lets its composed graph draw at
the pane its own layout actually handed over.

`<lr-mind-map>` already derived its own `viewBox` from a self-measured box; this brings `<lr-graph>`
in line with that sibling.
