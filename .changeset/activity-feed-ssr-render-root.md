---
"@aceshooting/lyra-ui": patch
---

`<lr-activity-feed>` no longer throws during a server render.

Its focus-repair capture runs in `willUpdate()` and read `this.renderRoot`
directly. `willUpdate()` runs before the first render, and under
`@lit-labs/ssr` there is no render root at all at that point, so any server
render of the component crashed with `Cannot read properties of undefined
(reading 'querySelector')`. It fired on the very first update because the guard
around it keys off `entries`, and a defaulted reactive property is always
reported as changed on first update.

Focus repair is meaningless before anything is painted, so an absent render root
now simply means "nothing to repair".

Swept the rest of the library for the same shape: every other `willUpdate()`
that reaches a render or shadow root either uses optional chaining, routes
through the shared active-element helper (which returns null for a nullish
root), or sits behind a focus-ownership precondition that cannot hold before
first paint. `<lr-activity-feed>` was the only genuine instance.
