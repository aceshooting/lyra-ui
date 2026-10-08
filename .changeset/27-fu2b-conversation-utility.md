---
'@aceshooting/lyra-ui': major
---

Conversation and utility follow-ups. Migration notes:

- `lr-prompt-input` gains `frame`, `actions-layout` and a forwarded `toolbar` slot, passed to its composed `lr-chat-composer`.
- The `lr-chat-message` collapse button now defaults its hover fill and color to the shared icon-button surface (`--lr-color-surface-raised` / `--lr-color-text`) instead of the brand tint; set `--lr-icon-button-bg-hover` / `--lr-icon-button-color-hover` to keep the previous look.
- `lr-flag` and `lr-qr-code` mount their announcement regions when a load or encode starts rather than on connect.
