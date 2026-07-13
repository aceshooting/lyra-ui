---
"@aceshooting/lyra-ui": minor
---

`lyra-generation-status`'s stop-button `aria-label` ("Stop generating") now routes through
`this.localize()` (sharing the existing `stopGenerating` key used elsewhere in the library), and
the tokens segment's singular/plural noun ("token"/"tokens") is now localizable too, matching
`lyra-json-viewer`'s/`lyra-word-cloud`'s existing count-noun pattern. Overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
