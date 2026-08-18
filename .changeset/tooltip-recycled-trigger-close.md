---
"@aceshooting/lyra-ui": patch
---

`<lr-tooltip>`: close a pointer-held tooltip when a re-render replaces its trigger.

A list that re-renders — a chat transcript, a log view, anything virtualized — replaces the `for`
target with a fresh node rather than moving the existing one. The outgoing element is detached
before it can fire the `mouseleave` that normally closes a resting tooltip, and the incoming element
is not necessarily under the pointer. `adoptTrigger()` correctly rebound its listeners to the new
node but let the tooltip inherit the outgoing node's open state, so the tooltip hung open over a
trigger nobody was pointing at. Reported live as several resting tooltips visible at once with the
pointer over none of them, via `<lr-copy-button>`'s default `tooltip="full"`.

A trigger swap now re-derives the open state from the incoming element: the tooltip stays open only
while that element is genuinely held — the pointer resting over it (`:hover`) or focus inside it —
and closes otherwise. Focus-, click- and `manual`-opened tooltips are untouched, and re-rendering a
row the pointer still rests on leaves its tooltip alone. Verified on Chromium, Firefox and WebKit.

The same report's secondary note about a tooltip being clipped inside a scroll container is existing
behavior with existing API: pass `hoist` (`<lr-copy-button>` already forwards it to its tooltip) to
render the popup in the top layer and escape the clipping ancestor.

Reported as lyra-admin request `fr_ZmtgQvx9zLCji_-SpXAd5w`.
