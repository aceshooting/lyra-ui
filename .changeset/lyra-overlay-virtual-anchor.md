---
"@aceshooting/lyra-ui": minor
---

Add `showAt(rect, options?)` to `<lr-popover>` and `<lr-tooltip>`, a virtual-anchor API that opens
the overlay positioned against an arbitrary rectangle (`{ x, y, width?, height? }`, defaulting to a
zero-size point) instead of the slotted `trigger`. This lets a canvas/SVG surface -- a `<lr-graph>`
node, a chart datum, a text-selection range -- get flip/shift/RTL-aware positioning, Escape,
light-dismiss, and (optional, via `options.returnFocusTo`) focus-return for free, without a
consumer hand-rolling absolute positioning and dismissal logic around it. Both components remain
fully backward compatible: a component that never calls `showAt()` behaves byte-identical to
before. `place()` (`src/internal/positioner.ts`) is widened from `HTMLElement` to `Element |
VirtualAnchor` to support this, with no behavior change for existing real-element anchors.
