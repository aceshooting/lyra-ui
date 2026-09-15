---
"@aceshooting/lyra-ui": minor
---

Add a `maxHeight` property (attribute `max-height`) and `--lr-markdown-max-height` token (default
`none`) to `lr-markdown`/`lr-markdown-core`, letting either scroll internally past a caller-set
height instead of growing the page — the same `maxHeight`/token shape already shipped on
`lr-json-viewer`, `lr-diff-view`, `lr-code-block`, `lr-stack-trace`, and `lr-document-compare`.
Unset, `[part="content"]` renders byte-identical to before.

Swept every other content-that-can-overflow component for the same gap. `lr-terminal`'s
`[part="viewport"]` is deliberately excluded: unlike the components above, it is always a
fixed-height virtualized scrollback region (`--lr-terminal-height`, default `20rem`, already the
cap), not a "grows until capped" surface, so the same property/token shape would fight rather than
complement its existing model. That decision is now recorded in `lr-terminal`'s own class doc.
