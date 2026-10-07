---
"@aceshooting/lyra-ui": patch
---
lr-chat-message, lr-message-feedback: status and feedback announcements go through the document's shared live region instead of rendering an `lr-live-region` element inside every message and feedback control, and the two entries no longer register `lr-live-region`.
