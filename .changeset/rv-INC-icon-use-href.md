---
"@aceshooting/lyra-ui": patch
---
`lr-icon` keeps a same-document `href` on slotted `<use>` elements (and writes `xlink:href` as `href`), and fetched icons share the same SVG guards instead of a second copy.
