---
"@aceshooting/lyra-ui": minor
---
lr-attachment-trigger: `lr-files` now carries `rejected`, `remainingFiles` and `remainingTotalSize` like `lr-file-input`, and picks that do not match `accept` (for example through the OS "All files" filter) arrive in `rejected` instead of `files`.
