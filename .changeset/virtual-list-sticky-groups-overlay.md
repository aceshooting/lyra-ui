---
"@aceshooting/lyra-ui": minor
---

Add `lr-virtual-list`'s sticky group header layer. Setting `renderStickyGroup` renders a
`[part="sticky-group"]` overlay pinned to the top of the scroll viewport showing whichever `groups`
entry the viewport is currently inside, pushed out by the overlap as the next group's header arrives
rather than swapped abruptly. Native `position: sticky` on the rows themselves is structurally inert
here, since every row is absolutely positioned and transform-offset by the windowing math.

The overlay is a visual copy of content that already exists in the list, so it is `aria-hidden`, its
ordinary focusable content is forced to `tabindex="-1"` (the real row keeps sole ownership of the
heading semantics and of the tab order), and it is `pointer-events: none` until a consumer opts in
with `lr-virtual-list::part(sticky-group) { pointer-events: auto; }`. It is measured by its own
`ResizeObserver` and never by the row observer, so a group header that is also a real row is not
double-counted in `row-height="auto"` mode. A `groups` entry whose `label` is the empty string now
renders no `[part="group"]` marker — it is a pure position anchor, for a host that renders its own
group headers as rows. With `renderStickyGroup` unset, nothing about the rendered output changes.
