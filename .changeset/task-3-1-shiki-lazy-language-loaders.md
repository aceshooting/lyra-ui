---
"@aceshooting/lyra-ui": minor
---

`<lr-code-block-core>`/`<lr-markdown-core>`'s `languages` map can now take a lazy loader per key
(`() => import('@shikijs/langs/bash')` or any `() => Promise<ShikiLanguageInput | { default:
ShikiLanguageInput }>`) instead of requiring every grammar to already be imported and resolved
before the map can be bound. A loader is called at most once per key, memoized, the first time a
fenced block actually requests that language; a fenced block whose language is absent from
`languages`, or whose loader fails, still renders the existing plain-text fallback. Binding a fixed
set of loaders instead of eagerly imported grammars lets a bounded-language-set consumer ship one
small chunk per grammar, fetched only for fences that actually occur, instead of downloading the
whole set upfront.
