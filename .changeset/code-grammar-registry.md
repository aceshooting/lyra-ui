---
'@aceshooting/lyra-ui': minor
---

Add a library-level syntax grammar registry for `<lr-code-block>` and `<lr-code-block-core>`.
`registerCodeGrammar(name, grammarOrLoader, { aliases? })` and `unregisterCodeGrammar(name)` are
exported from the root barrel and from
`@aceshooting/lyra-ui/components/conversation/code-block/code-grammar-registry.js`. A grammar object
or lazy loader registered once serves every code block on the page; a per-element `languages` or
`languageLoaders` entry still wins for the same language. Registering or removing a grammar
re-highlights the connected blocks that show that language, a loader that fails leaves the localized
plain-text fallback, and invalid names, aliases or sources throw a `TypeError` without registering
anything.
