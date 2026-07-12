---
"@aceshooting/lyra-ui": minor
---

`<lyra-widget>`: added `fullscreen-inset` (a raw CSS `inset` shorthand, e.g. `"0 0 0 240px"`, applied to
the fullscreen panel and backdrop instead of the default `var(--lyra-space-l)` on every side — for apps
with a persistent sidebar/toolbar that should stay visible during fullscreen) and a `compact` boolean
(tighter header/body padding), matching `lyra-empty`'s existing `compact` convention.
