---
"@aceshooting/lyra-ui": patch
---
lr-agent-workspace `messages`, lr-transcript-feed `entries` and lr-realtime-session `entries` now keep their newest rows when an assignment exceeds the collection limits, so new messages and captions keep appearing instead of silently stopping.
