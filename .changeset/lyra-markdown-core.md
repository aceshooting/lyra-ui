---
"@aceshooting/lyra-ui": minor
---

New `<lyra-markdown-core>` entry point: a build-lean variant of `<lyra-markdown>` for a consumer
whose `languages` map already covers every language it renders, mirroring the existing
`<lyra-code-block>`/`<lyra-code-block-core>` split. Its own module never imports shiki's ~200-
language default dynamic-import table -- `<lyra-markdown>`'s existing `languagesOnly` flag can't
give a bundler that guarantee, since it's checked at runtime, not statically provable. Every other
capability (GFM, heading anchors, text-quote highlights, math) is unchanged from `<lyra-markdown>`;
a fenced block whose language isn't in `languages` always renders the plain-text fallback.
