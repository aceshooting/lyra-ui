---
"@aceshooting/lyra-ui": patch
---

Document `orientationBreakpointBasis` on `<lr-split>` and `<lr-stepper>`, and the four
role-scoped bubble custom properties on `<lr-chat-message>`. Also corrects a claim that
a `rem` inside a CSS `@media` query resolves against the document root's computed font
size — it resolves against the browser's *initial* font size, which is exactly why the
`'viewport'` basis, and not `'container'`, is the one that matches a CSS `@media` rule.
