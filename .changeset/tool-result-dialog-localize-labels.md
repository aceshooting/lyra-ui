---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-result-dialog`'s tool-name fallback ("Tool call"), visible status label
("Pending"/"Running"/"Success"/"Error"/"Denied"), and maximize/restore button aria-label now route
through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
is unchanged.
