---
"@aceshooting/lyra-ui": minor
---

Make card headers wrap with their actions in narrow allocations, expose citation previews through
a stable tooltip relationship, and localize the complete citation status announcement.

Add reactive `accessibleLabel` overrides to both code-block variants and media cards so host
`aria-label` values reach the actionable or semantic element inside shadow DOM. Media-card's
unnamed actions now use complete, per-kind localized messages.

Keep markdown within logical narrow allocations and make its `streaming` state hold `aria-busy`
until the final content update.
