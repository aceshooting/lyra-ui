---
"@aceshooting/lyra-ui": minor
---

Add missing theming hooks to `lr-button`, `lr-card`, and `lr-segmented`, all undeclared by default
so existing rendering is unchanged unless a consumer opts in:

- `lr-button`: `appearance="link"` now resets `box-shadow: none`, so a globally-set
  `--lr-button-shadow` no longer paints a shadow behind a zero-chrome inline link. The shared hover
  rule also exposes `--lr-button-hover-color` and `--lr-button-hover-border`, letting appearances
  such as `quiet` (which already expose resting `--lr-button-quiet-text`/`-border`) theme their
  hover text/border independently; unset, each falls back to whatever colour/border the active
  `appearance` already paints at rest.
- `lr-card`: `::part(base)` gains `--lr-card-shadow` (default `none`, mirroring
  `--lr-button-shadow`'s pattern) for a raised card, plus `--lr-card-interactive-hover-shadow` on
  the `actionable`/linked hover state, which falls back to `--lr-card-shadow` itself.
- `lr-segmented`: the hover rule gains `--lr-segmented-hover-bg` and `--lr-segmented-hover-shadow`,
  alongside the existing `--lr-segmented-hover-color`. The track (`[part="base"]`) gains
  `--lr-segmented-track-bg` and `--lr-segmented-track-border-color`, replacing a literal
  `var(--lr-color-border)` read with an overridable one.
