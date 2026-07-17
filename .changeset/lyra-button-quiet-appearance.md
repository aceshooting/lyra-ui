---
"@aceshooting/lyra-ui": minor
---

`lyra-button` gains `appearance="quiet"`: a bordered, transparent-until-hover tier for a toolbar-style
icon+label action whose border/text read fixed `--lyra-color-border`/`--lyra-color-text-quiet` tokens
regardless of `variant`, unlike `appearance="outlined"`'s variant-tinted text — for a call site that
needs a genuinely muted resting state rather than a bold bordered button. New
`--lyra-button-quiet-border`/`--lyra-button-quiet-text` custom properties back the two tokens.
