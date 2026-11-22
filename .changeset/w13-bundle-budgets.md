---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-gen': patch
---

Size ceilings follow reviewed measurements after the consumer-gap theming tokens and options. These are the form, overlay, map, chart, table and layout hooks, plus dialog `fullscreen-narrow` and panel tokens, drawer `floating`, popover sizing, toast insets, chip-group selection, label placement, and the shared form-control transition and focus-outline hooks. Measured gzip bytes:

- 1,815,368 for `dist/autoloader-cdn.js` and 1,815,250 for `dist/autoloader.js`
- 487,533 for the data barrel, 296,640 for forms, 401,656 for media, 160,986 for overlays and 248,451 for utility
- 152,747 for `dist/lyra.js`; `prompt()` stays on its granular subpath, so the root entry does not carry `lr-input`
- 95,916 for the standalone combobox and 153,922 for the component p95
- 39,447 initial marginal bytes for combobox and 16,827 for tooltip

In `@aceshooting/lyra-gen`, the same additions change how gen-view's lazy chunks split. Lazy raw JavaScript grows by only 362 bytes, but the per-file gzip sum reaches 257,942 bytes. Chat-composition lazy JavaScript measures 1,044,304 raw and 305,790 gzip bytes.

Each exceeded ceiling advances only to the next 64-byte boundary above its measurement. Passing ceilings, the headroom policy and optional-peer exclusions are unchanged.
