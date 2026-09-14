---
"@aceshooting/lyra-ui": patch
---

`<lr-multi-split>`: `lr-multi-split-collapse-change` now fires after the collapsing panel is
decorated, not before.

The panel's own decoration — its `data-collapse-state` marker, the `hidden` flag the closed
`'floating'` drawer uses, and its owned inline sizing — was applied in the component's update
callback, which runs after the event had already been dispatched. A listener reading the panel
synchronously inside its own handler therefore saw the previous state's decoration (or none at
all) while the event and the host attribute already reported the new one, forcing consumers to
defer every panel-dependent read past the element's update completion and to add CSS masking the
undecorated frame.

The decoration pass now runs immediately before the event is emitted, so the panel a handler reads
is already in its new state. The event is still synchronous and still fires only on a real
transition — nothing about when it fires relative to the caller changed, only what the DOM looks
like by then.
