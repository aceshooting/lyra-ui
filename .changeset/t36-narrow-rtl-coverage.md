---
'@aceshooting/lyra-ui': patch
---

Add missing narrow-allocation (320px) and `dir="rtl"` regression coverage for `lr-chat-message`, `lr-command-palette`, `lr-file-icon` (`mode="label"`), `lr-streaming-text`/`lr-streaming-text-core`, and `lr-activity-feed`, so a future logical-CSS or RTL-mirroring regression in any of them is caught automatically instead of shipping silently.
