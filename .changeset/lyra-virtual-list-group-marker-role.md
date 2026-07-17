---
"@aceshooting/lyra-ui": patch
---

Fixes `<lyra-virtual-list>`: a `groups`-supplied group marker no longer carries `role="heading"`
`aria-level="2"`. Those markers render inside the scroll container's `role="list"`, and ARIA's `list`
role only permits `listitem` as a direct owned child — a `heading` sibling was a critical
`aria-required-children` violation for any consumer combining `groups` with an accessibility check
(surfaced by `<lyra-thread-list>`'s date-grouped rows). The marker is still rendered as visible,
non-interactive text; it's just no longer exposed as a heading landmark.
