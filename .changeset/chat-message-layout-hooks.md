---
'@aceshooting/lyra-ui': minor
---

`<lr-chat-message>` gains layout, border, announcement and failed-text hooks:

- `avatar-placement="start" | "end"` lays the avatar beside the body instead of in the header row (`"top"`, the default, is unchanged).
- `--lr-chat-message-bubble-border-width` (every role), `--lr-chat-message-bubble-border-color` (every role except `user`) and `--lr-chat-message-user-bubble-border-color` recolor or remove the bubble border.
- `--lr-chat-message-width` sets the bubble's inline size; `fit-content` shrinks a bubble to its content while it stays on its role's side.
- `announce-status="false"` turns off the built-in failure and streaming-complete live-region announcements while keeping the visible status text.
- `--lr-chat-message-failed-color` (default `var(--lr-color-text)`) paints failed bubble text, so a light role text color no longer lands on the pale failed fill. A failed `system` message now uses this readable color instead of the quiet system color.
