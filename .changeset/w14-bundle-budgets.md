---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-gen': patch
---

Size ceilings follow reviewed measurements after the `lr-table` structure options (stacked headers, header-less rows, row headers, row attributes, cell wrapping and the `--lr-table-*` tokens) and the consumer theming tokens and options across forms, layout, overlays, utility, data, media, charts and conversation. Measured gzip bytes:

- 1,835,181 for `dist/autoloader-cdn.js`, 1,835,012 for `dist/autoloader.js`, 1,595,774 for `dist/all.js` and 1,859,275 for `dist/ssr/all.js`
- 491,093 for the data barrel, 298,510 for forms, 415,697 for layout, 407,286 for media and 253,095 for utility
- 153,301 for `dist/lyra.js`
- 39,626 initial marginal bytes for combobox

With their documented styling hooks, the lyra-ui package measures 24,321,454 unpacked bytes (npm estimate) and the generated IDE data 1,946,895 packed archive bytes.

In `@aceshooting/lyra-gen`, gen-view lazy JavaScript measures 259,887 gzip bytes and chat-composition lazy JavaScript 1,051,747 raw and 307,678 gzip bytes.

Each exceeded ceiling advances only to the next 64-byte boundary above its measurement. Passing ceilings, the headroom policy and optional-peer exclusions are unchanged.
