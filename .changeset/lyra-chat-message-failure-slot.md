---
"@aceshooting/lyra-ui": minor
---

`lyra-chat-message` gains a `failure` slot, only ever rendered while `status="failed"`. Left empty
(the default), today's built-in failed-state UI is unchanged: the `[part="status-text"]` message,
the `[part="retry-button"]`, and the `chatFailedAnnounce` live-region announcement all keep working
exactly as before. Once the slot has assigned content, that built-in status text and retry button
are suppressed -- the host is now fully responsible for its own failure presentation (e.g. a
prominent, translated `role="alert"` banner with its own retry control), and the built-in
live-region announcement is suppressed too, so a host's own alert content doesn't get double
announced alongside a generic built-in one. The `failure` slot itself contributes no box
(`display: contents`), so the host's content lays out exactly as authored without needing any
`::part(failure)` override. Content assigned to it should carry `role="alert"` itself when it
represents an actionable send failure -- this component has no way to add that role on the host's
behalf. Programmatic focus is rescued to `[part="bubble"]` (mirroring the existing built-in retry
button's own focus rescue) whenever the failure slot's content held focus and `status` changes away
from `"failed"`, so a host's own retry control clearing the failed state never silently drops focus
to `document.body`. The existing `lr-retry` event contract is untouched; a host's own retry control
can dispatch it manually to stay consistent with listeners elsewhere in a conversation surface, but
nothing requires it to.
