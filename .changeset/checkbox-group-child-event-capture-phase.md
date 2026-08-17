---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-checkbox-group>` occasionally leaking a child `<lr-checkbox>`'s own raw `lr-change`
(`{checked, value}`-shaped detail) to an ancestor listener, ahead of the group's own translated
`lr-change` (`{value: string[]}`-shaped detail) — two events instead of one, the first the wrong
shape. `onChildEvent`'s `stopImmediatePropagation()` only protects a listener that runs *after* it;
the internal listener was registered on the default bubble phase in `connectedCallback()`, which
only outraces a consumer's *own* bubble-phase listener when that listener happens to be registered
later. A Lit `@lr-change=${...}` template binding — the common case — attaches its listener while
the element is still a disconnected fragment, before `connectedCallback` ever runs, so it saw the
unstopped child event first. The internal listener now runs in the capture phase instead, which
always completes before any bubble-phase listener on the same node fires, regardless of
registration order.
