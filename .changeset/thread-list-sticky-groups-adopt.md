---
"@aceshooting/lyra-ui": minor
---

Add `sticky-groups` to `lr-thread-list`: the current date/custom group's header stays pinned to the
top of the scroll viewport while its rows are in view, and is pushed off as the next group's header
arrives. Group headers are ordinary virtualized rows, so this renders an `aria-hidden` copy into
`lr-virtual-list`'s sticky layer — the real row keeps the `role="heading"` semantics and the tab
order, while the pinned copy stays clickable and requests the same `lr-group-toggle` collapse. The
band is exported as `::part(group-sticky)`, and the copy renders the same
`group-header`/`group-toggle`/`group-label`/`group-icon` parts as the real header, so existing
header styling applies to both. Default `false` renders exactly as before.
