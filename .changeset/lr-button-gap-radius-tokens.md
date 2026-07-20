---
"@aceshooting/lyra-ui": minor
---

Add `--lr-button-gap` and `--lr-button-radius` custom properties to `<lr-button>`, so the
icon/label gap and corner radius are retunable without a `::part(base)` rule — matching the
retunable-without-`::part()` treatment `--lr-button-padding-block/-inline` and
`--lr-button-font-size` already have.
