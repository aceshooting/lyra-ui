---
"@aceshooting/lyra-ui": patch
---

`lr-icon` and `lr-icon-button` clone slotted custom SVG content into a real SVG namespace so it
paints reliably (Chromium doesn't reliably paint slotted SVG geometry). That clone copied every
source attribute verbatim, including event handlers (`onload`, `onclick`, ...) and `href`/
`xlink:href`, with no sanitizer in the loop — unlike a fetched `src` document, which is already
sanitized through DOMPurify. Both clone paths now drop event-handler and `href`/`xlink:href`
attributes (a new shared `isUnsafeSvgCloneAttribute()` helper); every other presentational
attribute (`d`, `fill`, `stroke`, `viewBox`, `transform`, gradient stops, ...) is unaffected.
