---
"@aceshooting/lyra-ui": minor
---

`lr-mutation-observer`'s Lyra-only `attributes` (`observeAttributes`) and `character-data` (`characterData`) aliases are deprecated in favour of the mirrored `attr` and `char-data` (`charData`), with removal no earlier than 23.0.0. Both keep reflecting and enabling observation until then, and setting either logs one development-mode warning per page. Replace `character-data` with `char-data`. Replace `attributes` with `attr="*"` only when `attr`, `attr-old-value` and `attributeFilter` are all unset; otherwise remove it, because those already turn attribute observation on and a non-null `attr` ignores `attributeFilter`, so adding `attr="*"` next to a filter would observe every attribute.
