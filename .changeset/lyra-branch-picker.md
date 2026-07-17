---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-branch-picker>`: a controlled "‹ 2 / 5 ›" navigator across regenerated/edited variants of
one chat message, mirroring `lyra-pagination`'s "never mutates its own state" contract. Fires
`lyra-branch-change` with the requested (always in-bounds) index; the host swaps the displayed branch
content and applies the new index back. Designed to slot into `lyra-message-actions`' default slot or
directly into `lyra-chat-message`'s `actions`/`badges` slots.
