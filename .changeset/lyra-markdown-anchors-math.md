---
"@aceshooting/lyra-ui": minor
---

`lyra-markdown` gains `heading-anchors` (stamps computed GitHub-slugger-style ids on headings),
`getHeadingTree()` (a document-ordered heading outline, computed regardless of `heading-anchors`),
`fragment`/`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `anchor`,
`scrollToAnchor()`, events `lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result`), and
`math` (renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer, falling back to
literal source text when the peer isn't installed). Previously there was no way to deep-link into a
section, highlight a quoted passage, or render math in rendered Markdown content.
