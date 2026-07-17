---
"@aceshooting/lyra-ui": minor
---

Adds the shared `LyraAnchor`/`LyraHighlight` grounding-bridge type module
(`@aceshooting/lyra-ui/components/document-viewer/anchors.js`): a W3C Web-Annotation-inspired
discriminated union (`page`, `text-quote`, `fragment`, `line-range`, `cell-range`, `cfi`,
`time-range`, `region`, `node-path`) that every anchor-capable viewer and every knowledge-grounded
citation surface will address a passage through. Pure types plus one constant; nothing to register,
no runtime behavior change for existing components.
