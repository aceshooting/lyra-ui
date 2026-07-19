---
"@aceshooting/lyra-ui": patch
---

`<lr-notebook-viewer>` now interprets ANSI SGR color/style escape codes embedded in stream and error
outputs (common in colorized Python tracebacks and console output), rendering them as styled spans
via the same shared `internal/ansi.ts` parser `<lr-terminal>` uses, instead of showing the raw
escape sequences as literal text.
