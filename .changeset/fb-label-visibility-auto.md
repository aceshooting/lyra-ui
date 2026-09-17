---
"@aceshooting/lyra-ui": minor
---

`<lr-filter-bar>`: a filter definition's `labelVisibility` accepts a third value, `'auto'`.

`'visible'` and `'hidden'` were an all-or-nothing choice made once, at definition time, for a
component that is as likely to sit in a 320px side panel as across a full page — so a bar authored
for a dashboard lost a whole row of vertical space in a drawer, and one authored for the drawer
shipped unlabelled fields to the dashboard. `'auto'` renders exactly what `'visible'` does (same
stacked label element, same accessible name computed from it, no `aria-label` and no placeholder
fallback) and visually clips that label once the bar's **own** allocation — a container query on the
host, not the viewport — drops below `30rem`. The label element stays in the DOM at every width, so
the field's accessible name is identical in both states; the previous workaround, visually hiding
`::part(filter-control-label)` from a consumer stylesheet, removed the name along with the text.

`'checkbox-menu'` participates through its own trigger label run, the same one `'hidden'` already
clips there.

`'visible'`, `'hidden'` and an unset `labelVisibility` are unchanged at every allocation. The host
does become an inline-size query container (with the library's standard
`contain-intrinsic-inline-size` fallback), which is a no-op for a bar in an ordinary block or flex
allocation.
