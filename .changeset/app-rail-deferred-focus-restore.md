---
'@aceshooting/lyra-ui': minor
---

`lr-app-rail`'s mobile overlay now completes its focus return after the close has been published
and the host has re-rendered. A host that hides its own menu button while the overlay is open and
re-shows it in response to `lr-toggle` previously lost focus to `<body>` on every close, because the
return ran before that re-render. When the return cannot land immediately, it is retried once the
close's update has completed and a frame has passed, without taking back focus moved elsewhere in
the meantime. If the trigger still cannot take focus, the element focused when the overlay opened,
then the built-in toggle, receive it instead.

The same deferred focus return now also covers `lr-page`'s mobile navigation drawer (falling back to
the default navigation toggle, then the main landmark), `lr-responsive-panel`'s overlay
presentation, and `lr-dialog`/`lr-drawer` (retried after the exit animation, so an opener re-shown
from `lr-after-hide` is reached too).

**New: `lr-app-rail` re-resolves its `trigger`/`for` association at close, not just at open.**
Previously the element that would receive focus back was captured once, when the overlay opened.
Now, unless the overlay was opened by the built-in toggle button's own click (which still keeps
that click as the explicit, higher-priority return target throughout the open/close cycle),
`lr-app-rail` re-reads the `trigger`/`for` association again right before the overlay closes and
prefers whatever it currently resolves to — falling back to the target captured at open only when
the live association no longer resolves to anything. This means reassigning `trigger`/`for` while
the overlay is still open changes where focus lands on close, which was not previously possible:
the return target used to be fixed for the lifetime of that open/close cycle.
