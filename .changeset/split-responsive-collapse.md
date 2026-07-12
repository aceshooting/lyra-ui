---
"@aceshooting/lyra-ui": minor
---

Add `lyra-split` opt-in responsive collapse (`collapse="start"|"end"`, `rail-width`, `rail-breakpoint`, `float-breakpoint`): below `rail-breakpoint` the chosen pane clamps to a fixed rail width, below `float-breakpoint` it becomes an absolutely-positioned floating overlay, both signaled via a `data-collapse-state` attribute/dataset marker and the new `lyra-split-collapse-change` event.
