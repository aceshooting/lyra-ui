---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-trigger`: add a `triggerTitle` property forwarded to the internal trigger
button(s)' native `title` (a sighted-mouse-user hover tooltip, distinct from `triggerLabel`'s
`aria-label` role); reduce the internal `.trigger-button:hover` rule's specificity via `:where()`
so a consumer's `::part(trigger):hover` override wins without needing `!important`.
