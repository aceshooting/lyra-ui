---
"@aceshooting/lyra-ui": minor
---

Widens `DocumentFile` with optional `anchor`/`highlights`/`alt` fields and
`DocumentRendererDefinition` with an optional `capabilities` declaration; `lyra-document-viewer` gains
matching `anchor`/`highlights`/`alt` properties, forwards them to the resolved renderer, and emits
`lyra-anchor-result { found }` once per applied anchor. Every addition is optional and every existing
registration/usage is unaffected — this removes the previous limitation where even a renderer's own
props (like pdf's `page`) couldn't be reached through the router.
