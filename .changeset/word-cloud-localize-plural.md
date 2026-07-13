---
"@aceshooting/lyra-ui": minor
---

`lyra-word-cloud`'s default aria-label's pluralized "word"/"words" noun now routes through
`this.localize()` too, so a registered translation of the `wordCloud` template's `{word}` slot is no
longer stuck in English. Default output is unchanged.
