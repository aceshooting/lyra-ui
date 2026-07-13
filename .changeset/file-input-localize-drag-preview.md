---
"@aceshooting/lyra-ui": minor
---

`lyra-file-input`'s drag-preview live-region announcements ("Release to add the file." / "This file
type is not accepted.") now route through `this.localize()`, overridable via `.strings`/
`registerLyraLocale()`. Default English text is unchanged. The post-drop `acceptedMessage`/
`rejectedMessage` properties and the visible `label` property are unaffected (already
consumer-overridable).
