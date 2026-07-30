---
"@aceshooting/lyra-ui": patch
---

Stop retaining one live `Range` per search match in every text viewer. `<lr-archive-viewer>`,
`<lr-calendar-viewer>`, `<lr-contact-viewer>`, `<lr-email-viewer>`, `<lr-geojson-view>`,
`<lr-html-viewer>`, `<lr-include>`, and `<lr-pptx-viewer>` share a search mixin that held a live
`Range` for every match. The engine revalidates each retained `Range` on every DOM mutation in its
document, so a short query over a long document made every later mutation dramatically slower.
Matches are now kept as inert offsets, and only a bounded window around the active match is
materialized and painted. `matchCount`, `searchNext()`, and `searchPrevious()` still cover every
match.
