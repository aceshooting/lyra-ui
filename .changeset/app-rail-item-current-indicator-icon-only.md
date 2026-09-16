---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail-item>`'s `[part="current-indicator"]` full-height edge bar now suppresses itself by
default in the `icon-only` presentation, where it previously painted a broken-looking bar across a
square icon tile. `--lr-app-rail-item-current-indicator-display` restores it per instance. A new
`--lr-app-rail-item-current-ring` token adds an inset ring on the icon-only current tile by
default — a non-color-only signal (WCAG 1.4.1) that replaces the suppressed bar there — while
leaving the full presentation, which already conveys current state through the bar and
`--lr-app-rail-item-current-font-weight`, ring-free by default. Setting the ring token explicitly
applies the same value in both presentations. Full presentation is otherwise byte-identical to
before.
