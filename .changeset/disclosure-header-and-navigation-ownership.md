---
"@aceshooting/lyra-ui": patch
---

Keep disclosure header boundaries at the control-border tier and use readable text colors while pressed: the card edges of `lr-thinking-panel`, `lr-task-list` and `lr-source-list` stay on `--lr-color-border`, because each header is a borderless button whose only visible boundary is that edge, and the quiet `lr-thinking-panel` duration (including the pending label) and `lr-task-list` summary now follow the header's own colour on hover and press instead of losing contrast on the tint. Navigation-menu items now release their parent ownership when detached, so moving them out of a removed menu restores their standalone disclosure behavior.
