---
"@aceshooting/lyra-ui": patch
---

`<lr-virtual-list>` no longer rescans the whole `items` array on every scroll frame to resolve
`active-id`. The lookup is now memoized on the `items`/`active-id`/`keyFunction` identities, so
scrolling a large list stops calling `keyFunction` once per item per frame.
