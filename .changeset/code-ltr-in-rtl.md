---
"@aceshooting/lyra-ui": patch
---

Code now reads left-to-right inside right-to-left documents. This covers:

- `lr-markdown`/`lr-markdown-core` fenced, indented and inline code, including the plain-text view
  shown while streaming;
- the scroll area, language badge and file name of `lr-code-block`/`lr-code-block-core`;
- `lr-notebook-viewer` raw cells, `lr-geojson-viewer` metadata, `lr-stack-trace` function names and
  `lr-terminal` without `wrap`.

Some text now takes its direction from its own content: authored preformatted text inside
Markdown, `lr-tool-result-view` text results and `lr-test-results` failure messages. Surrounding
prose, block margins and headers still follow the page direction, and explicit `dir` attributes on
authored code are honored. Code scroll areas now open at the start of the code. As a result, under
`dir="rtl"` the vertical scrollbar of `lr-code-block`, `lr-code-block-core` and `lr-terminal`
without `wrap` sits on the physical right.
