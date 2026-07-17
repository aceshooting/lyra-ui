---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-artifact-panel>`: a shell around one generated artifact — title/kind header, a
preview↔code toggle (rendered only once the `code` slot has content), version navigation with a
"Restore this version" affordance (`lyra-version-change`/`lyra-restore`, versions are host state),
`streaming`/`aria-busy` state, and built-in copy/download actions. Renders none of the artifact
itself — content is slotted.
