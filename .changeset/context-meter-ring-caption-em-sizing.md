---
"@aceshooting/lyra-ui": patch
---

Fixed: `<lr-context-meter shape="ring">`'s centered caption (`.ring-label`, inside `part="label"`)
now sizes itself in `em` (`calc(var(--lr-size-1em) * 0.625)`) instead of the previous
`rem`-anchored `--lr-font-size-2xs`. The ring itself is already `--lr-size-8em`, so a caller's own
`font-size` on the host shrinks the ring but previously left the caption pinned to the document
root — the same defect shape `<lr-gauge>`'s linear caption had. At the default (unmodified ambient
font) size the resolved caption size is unchanged.
