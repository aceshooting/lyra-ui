---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-chip`'s `compact` variant now also shrinks font-size and gap (via new
`--lyra-attachment-chip-compact-font-size`/`-compact-gap` custom properties), not just
border/radius/padding/thumbnail-size. Also adds `thumbnailOnly`, which -- combined with `compact`
on an image-mime chip -- hides the filename/size text entirely for a pure thumbnail density with
no consumer-side CSS.
