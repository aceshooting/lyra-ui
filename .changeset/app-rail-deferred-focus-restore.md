---
'@aceshooting/lyra-ui': patch
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
from `lr-after-hide` is reached too). `lr-app-rail` now also resolves `trigger`/`for` again when the
overlay closes, so reassigning either while it is open changes where focus returns, as documented.
