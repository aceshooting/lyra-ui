---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-poll-status`, `lyra-typing-indicator`, and `lyra-stream-status`'s ambient "still alive" pulse/bounce animations, which reused `--lyra-transition-base` (180ms — reserved for discrete UI micro-interactions) and rendered as a fast flicker instead of a calm breathing loop. Adds a dedicated `--lyra-transition-ambient` token (1.8s) for infinite looping indicators.
