---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-chip`: fix the uploading progressbar/spinner's `aria-label` to actually use
`uploadingLabel` (previously hardcoded, unlike the adjacent visible status text); add an
`untitledLabel` override for the empty-name fallback; add a `compact` density variant.
