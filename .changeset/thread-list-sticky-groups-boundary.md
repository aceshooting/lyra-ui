---
"@aceshooting/lyra-ui": minor
---

Remove `lr-thread-list`'s reach into the internal `lr-virtual-list`'s shadow root. Arrowing past the
rendered window now scrolls through the child's public `scrollContainer` and waits for its
`lr-scroll` notification before moving focus, instead of mutating the scroll position of an element
found by querying the child's render root and then dispatching a fabricated `scroll` event at it —
which also raced the child's re-render rather than following it. Row lookup goes through a new
`lr-virtual-list.renderedRows` accessor (the currently-windowed `[part="row"]` wrappers, in item
order), added because a windowed list gives a host no other way to reach a row that may not have
existed a frame earlier; `exportparts` forwards styling, not element references.
