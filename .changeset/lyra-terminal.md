---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-terminal>`: a read-only, virtualized ANSI console for streamed agent/tool output — SGR
color rendering (16 named colors, 256-color, truecolor), stick-to-bottom `follow` with a
`lyra-follow-change` event, `write()`/`content` streaming, `\r`/`\b`/`\t` cursor handling so progress
bars render correctly, in-buffer `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`,
`line-range` highlight/anchor support (`scrollToAnchor()`, `lyra-highlight-activate`), and built-in
copy/download affordances. Not a PTY — no stdin/keystroke handling or cursor-addressed full-screen
apps.
