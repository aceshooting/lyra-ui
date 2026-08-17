---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-chat-message>`'s `[part='actions']` pinning its footer actions to the inline end
regardless of `message-role`, detaching an assistant/system turn's copy/regenerate controls from
their own start-aligned (and often transparent-background) bubble. `[part='actions']` now scopes
its `margin-inline-start: auto` to `message-role="user"` and adds the mirrored
`margin-inline-end: auto` for `assistant`/`system`, matching the role-conditional alignment
`[part='bubble']` already uses. `actions-position="outside"` is unaffected for every role.
