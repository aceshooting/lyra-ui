---
"@aceshooting/lyra-ui": minor
---

Adds an internal, dependency-free ANSI/SGR parser (`src/internal/ansi.ts`, not a public export) —
shared groundwork for `lyra-terminal`'s streamed console-output rendering. No public API surface
change on its own; ships alongside the `lyra-terminal` component in the same release.
