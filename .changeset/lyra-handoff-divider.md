---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-handoff-divider>`: a labeled semantic separator marking control transfer between agents
in a transcript (e.g. "Transferred to Research Agent"), with an optional `avatar` slot. Root is
`role="separator"` named by the computed label; the label is announced once on first connect
through an internal live region, since a handoff lands mid-stream and later property changes never
re-announce.
