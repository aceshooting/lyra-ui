---
"@aceshooting/lyra-ui": minor
---

Added `<lr-streaming-text-core>`, a build-lean `<lr-streaming-text>` variant that composes
`<lr-markdown-core>` instead of `<lr-markdown>` in Markdown mode, so a consumer whose fenced-code
language set is bounded no longer needs to pull `<lr-markdown>`'s ~200-language dynamic-import
table into the graph just to use the streaming renderer. `<lr-streaming-text>` also gains a new
`languages` property (`Readonly<Record<string, ShikiLanguageInput>>`, unset by default), forwarded
verbatim to whichever Markdown element it composes — the same fine-grained language-grammar
scoping `<lr-code-block>`/`<lr-markdown>` already support.
