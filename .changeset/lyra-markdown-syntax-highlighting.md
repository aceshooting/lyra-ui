---
"@aceshooting/lyra-ui": minor
---

`lyra-markdown` gains real shiki syntax highlighting for fenced code blocks, reusing
`<lyra-code-block>`'s own optional `shiki` peer and grammar-loading machinery directly (not by
embedding `<lyra-code-block>` itself, which would have hit DOMPurify's default custom-element
blocklist and re-mounted — losing state and re-triggering async loads — on every streaming chunk).
On by default whenever the `shiki` peer is installed (set `highlightCode="false"` to opt out); new
`languages`/`languagesOnly` properties mirror `<lyra-code-block>`'s own fine-grained bundle-size
controls. Highlighting is skipped entirely while `streaming` is `true` and applied once a stream
settles, so there is no added per-chunk cost while content is still arriving.
