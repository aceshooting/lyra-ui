---
"@aceshooting/lyra-ui": minor
---

`lyra-markdown`: add `part="paragraph"`, `part="list"` (both `<ul>` and `<ol>`), and
`part="inline-code"` (bare inline codespans only, not a fenced code block's `<code>`, which
already has its own `part="code-block"` wrapper) so a consumer's `::part()` CSS can reach plain
text elements that previously had no themeable hook.
