---
"@aceshooting/lyra-ui": minor
---

`lyra-chip-group`'s collapsed overflow-indicator's visible "+N" text now routes through
`this.localize('showMoreCollapsed', ...)`, matching the aria-label it sits beside, which was already
localized. Default English output ("+N") is unchanged.
