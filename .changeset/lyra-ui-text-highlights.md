---
"@aceshooting/lyra-ui": minor
---

Adds `internal/text-highlights.ts`: a highlight paint manager for HTML-flow document viewers, using
the CSS Custom Highlight API when available and falling back to `<mark>`-wrapping otherwise, with a
uniform `acquireHighlightHandle()` API that never requires callers to branch on browser support
themselves. Internal module with no public tag and no adopter yet in this release; ships ahead of the
markdown/html-viewer/docx-viewer highlight support that will consume it. No behavior change for any
existing component.
