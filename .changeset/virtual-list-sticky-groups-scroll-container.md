---
"@aceshooting/lyra-ui": minor
---

Add `lr-virtual-list`'s public `scrollContainer` getter (the `[part="base"]` scroll box, `undefined`
before the first render) and an `lr-scroll` event (`detail: { scrollTop, viewportHeight }`). The
event is emitted from the animation frame that already coalesces native `scroll` events, so a burst
of them produces at most one `lr-scroll` per frame and none at all when the position did not change.
Together they let a host follow *sub-row* scroll movement — which `lr-visible-range-changed`, firing
only on index-range changes, cannot report — without reaching into the component's shadow root or
dispatching synthetic `scroll` events at it.
