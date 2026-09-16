---
"@aceshooting/lyra-ui": minor
---

Fixed `<lr-progress-ring>`'s track/indicator stroke width silently changing from its documented `4px`
default to `3px` for any consumer who imports `theme.css` and sets no override at all. The stroke
width used to bridge the widely-shared `--lr-theme-border-width-thick` theme input directly, and
`theme.css` declares that input at `3px` -- the correct default for the many surfaces that genuinely
share it, but not for this ring, whose own default has always been `4px`. It now reads a dedicated
`--lr-theme-progress-ring-track-width` theme input instead: unset by default whether or not
`theme.css` is imported, so the ring always renders at `4px` until a consumer sets this property on
`:root` or any ancestor to retune it.
