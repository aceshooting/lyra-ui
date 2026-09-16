---
"@aceshooting/lyra-ui": patch
---

`<lr-data-grid>` no longer treats an unchanged re-bind of `filters` or `sort` as a change. Both
setters rebuilt a fresh frozen array on every write, so the new reference was never `===` the old one
and Lit's dirty check always reported a change. Because a `filters`/`sort` change schedules a server
request — and a `filters` change schedules the *debounced* one — a host that re-binds these
properties on every render (the ordinary controlled pattern, often driven by the grid's own events)
could push the server request further away indefinitely, and re-rendered for nothing in the meantime.

The setters now compare the normalized content and keep the held value, including its reference, when
nothing actually changed. A genuinely different value still schedules exactly as before.
