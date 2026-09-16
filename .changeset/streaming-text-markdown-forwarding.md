---
"@aceshooting/lyra-ui": minor
---

`<lr-streaming-text>`/`<lr-streaming-text-core>` forward the rest of the composed `<lr-markdown>`/
`<lr-markdown-core>` configuration surface verbatim: `tabSize`, `htmlMode`, `gfm`, `linkTarget`,
`internalLinkPrefix`, `headingOffset`, `highlightCode`, `headingAnchors`, `math`, and `maxHeight`,
alongside the already-forwarded `content`, `streaming`, and `languages`. Previously every one of
these was pinned at the composed element's default and unreachable through the wrapper, so a
consumer who had deliberately set, for example, `link-target=""` for same-tab links silently got
`target="_blank"` back after adopting `<lr-streaming-text>`. Each new property defaults to exactly
the composed element's own default, so leaving all of them unset renders identically to before.
The composed element still applies its own `rel="noopener noreferrer"` guard whenever a forwarded
`linkTarget` emits a `target`, and never a bare `opener`.
