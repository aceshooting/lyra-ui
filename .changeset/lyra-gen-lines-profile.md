---
"@aceshooting/lyra-gen": minor
---

`@aceshooting/lyra-gen/lines.js` adds Lyra Lines, an opt-in compact output profile: one indented line per node with the catalog's required properties written positionally, optional properties as `key=value`, node members as `@member=JSON` and text after `| `. `parseLines()` and the streaming `createLinesParser()` turn it into an ordinary JSON v1 view before validation and storage, so nothing is stored in a new format; `encodeLines()` writes it losslessly, and `buildLinesPrompt()` (`@aceshooting/lyra-gen/prompts-lines.js`) asks a model for it. A header pins the positional order to the catalog id and version, ids are explicit unless `elideIds` derives `<type>-<n>` before validation, and the bounded parser rejects ambiguous or oversized input with line and column diagnostics instead of guessing. On the offline dashboard benchmark it measures about 0.56x the approximate tokens of JSON; it stays opt in until evaluated with a real model.
