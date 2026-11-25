---
"@aceshooting/lyra-gen": minor
---

Smaller model-facing prompts and schemas, plus provider tool helpers. `buildCatalogPrompt()` now leaves out renderer-only metadata and the implicit object closure and default number range while keeping every bound a model must respect (about 15-19% fewer tokens), and accepts `format: 'markup'` (Lyra Markup output with Markup examples), an opt-in `profile: 'signature'` that describes each role on one typed line (about a quarter of the size), and `examples`. `exportCatalogJsonSchema()` hoists repeated sub-schemas into `$defs` (about a quarter of the size; `{ inline: true }` returns the equivalent inline schema). New `buildRefinementPrompt()` asks for a patch scoped to one node with only the roles it uses, and `@aceshooting/lyra-gen/provider-tools.js` wraps prompt and schema as Anthropic, OpenAI and AI SDK-style tool definitions with an `estimatePromptTokens()` approximation.
