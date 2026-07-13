---
"@aceshooting/lyra-ui": minor
---

`lyra-code-block`: add a `languagesOnly` opt-in that skips the default `loadShikiHighlighter()`
call entirely, so a consumer whose `languages` map already covers every language it renders has no
bundler-reachable path to shiki's full per-language dynamic-import table.
