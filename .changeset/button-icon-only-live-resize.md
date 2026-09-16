---
"@aceshooting/lyra-ui": patch
---

`<lr-button>` now re-evaluates its icon-only geometry when the slotted label's visibility changes
through CSS alone. Detection ran on `slotchange` and once on the first update, so the most natural
responsive idiom — a container or media query hiding the label at a narrow width — changed computed
style with no DOM mutation and nothing re-ran: the button kept full text geometry, padding and
min-width around an invisible label. It happened to look right only when the element was created
after the breakpoint was already crossed, which made it read as an intermittent bug.

A `ResizeObserver` now watches the label wrapper's own box. It deliberately does not watch the host
or the base part: once icon-only, those take a fixed size, so widening the container would not resize
them and the button could never flip back — the same one-way trap the fix exists to remove. The
recompute is deferred to an animation frame, matching `<lr-textarea>`'s auto-grow observer, because a
microtask-deferred write lands inside the same delivery pass and trips a ResizeObserver loop warning.
