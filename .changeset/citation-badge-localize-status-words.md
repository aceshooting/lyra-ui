---
"@aceshooting/lyra-ui": minor
---

`lyra-citation-badge`'s visible status words folded into its computed accessible name ("High
confidence"/"Medium confidence"/"Low confidence"/"Verified"/"Unverified") now route through
`this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
unchanged when no override is set.
