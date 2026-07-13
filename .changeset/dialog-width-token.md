---
"@aceshooting/lyra-ui": minor
---

`lyra-dialog` gains `--lyra-dialog-width`, unset by default -- when set, the panel actually
stretches to that width instead of only shrink-wrapping its content capped at
`--lyra-dialog-max-width`, which was a real gotcha for anyone porting from `wa-dialog`'s
assertive `--width` token.
