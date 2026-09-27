---
"@aceshooting/lyra-ui": minor
---

The `DocumentFile` and `DocumentRendererDefinition` types exported by `components/viewers/document-viewer/registry.js` (and the package root) are deprecated in favour of `LyraDocumentFile` and `LyraDocumentRendererDefinition`, with removal no earlier than 23.0.0. They are type-only, so TypeScript editors strike them through where you write them, and no runtime warning exists. Each pair is interchangeable in both directions, so renaming your own annotations is safe now. Exported function and registry signatures keep the unprefixed names until the removal, so no existing signature changes in this release.
