---
"@aceshooting/lyra-ui": patch
---

Verified and documented that `--lr-icon-button-border` reaches every 16.0.0 composed icon action
(`<lr-dialog>`'s close control, `<lr-reorder-item>`'s move controls, `<lr-code-block>`'s copy
control, `<lr-attachment-trigger>`'s trigger) the same way `--lr-icon-button-background`/`-color`/
`-radius` do. A report read the absence of a relayed `--_lr-icon-button-border-default` on
`<lr-dialog>`/`<lr-reorder-item>`/`<lr-code-block>` (none of which paint a resting border) as
border theming being broken for those components. Rendered `getComputedStyle` assertions now cover
all four components, including `<lr-attachment-trigger>`'s `outlined`/`filled-outlined`
appearances, which DO relay a non-zero border default and must still let an ancestor's public
token override it. No source change was needed — the public token was already the first, winning
arm of the fallback chain in every case; only test coverage and the authored `llms/` reference
pages were missing an explicit statement of the rule.
