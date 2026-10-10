---
"@aceshooting/lyra-ui": minor
---

`<lr-segmented>`'s checked segment is distinguishable on its own in every look and mode. It was a surface-coloured pill with a hairline shadow, about 1:1 against a surface-coloured card or dialog (WCAG 1.4.11). The defaults are now `--lr-segmented-selected-bg: var(--lr-color-text)` and `--lr-segmented-selected-color: var(--lr-color-surface)`, an inverted pill at 13:1 or more against its container. Consumers that override `--lr-segmented-selected-bg` should also set `--lr-segmented-selected-color` to a label that contrasts with their fill; overrides keep winning.
