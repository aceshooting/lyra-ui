---
"@aceshooting/lyra-ui": minor
---

Add `lyra-code-block-core`: a build-lean variant of `lyra-code-block` for a consumer whose
`languages` map already covers every language it renders. Unlike `languagesOnly` (a runtime flag
on `lyra-code-block` itself, which a bundler can't prove always-true and so can't tree-shake),
`lyra-code-block-core` is a genuinely separate module that never references shiki's full
~200-language default entry point at all -- importing it instead of `code-block.js` gives a real
compile-time exclusion of that table from the build output.
