---
"@aceshooting/lyra-ui": minor
---

`lyra-code-block` and `lyra-code-block-core` gain `highlight-lines` (declarative `"3-5,7"`-style
line emphasis), `interactive-lines` (turns the line-number gutter into a keyboard-navigable,
clickable roving-tabindex group emitting `lyra-line-click`), and `line-range` anchor-target support
(`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lyra-text-select`) — identical on
both components since they share the new line-addressing logic. Previously there was no way to
emphasize or deep-link to a specific line/range of lines in a rendered code block.
