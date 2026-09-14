---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-button href>` rendering an underlined label for every non-link appearance. In anchor mode
the root is a real `<a>`, which the user-agent stylesheet underlines, and the shared `[part="base"]`
rule never reset `text-decoration` — so an `appearance="accent"` link button was underlined while the
same button without `href` was not. The base now declares `text-decoration: none`, matching
`<lr-icon-button>`. `appearance="link"` keeps its underline in both modes, and a consumer
`::part(base)` `text-decoration` rule still wins.
