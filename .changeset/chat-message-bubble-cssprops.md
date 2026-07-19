---
"@aceshooting/lyra-ui": minor
---

Add role-scoped bubble cssprops to `lr-chat-message` — `--lr-chat-message-bubble-bg`,
`--lr-chat-message-bubble-color`, `--lr-chat-message-user-bubble-bg`, and
`--lr-chat-message-user-bubble-color` — so a consumer can retint one role's bubble fill/text
without overriding the shared `--lr-color-brand-quiet`/`--lr-color-surface`/`--lr-color-text`
tokens, which also drive unrelated parts of the component (e.g. `[part="collapse-button"]:hover`).
All four default to exactly the values the bubble already used, so nothing changes for existing
consumers who set none of them.
