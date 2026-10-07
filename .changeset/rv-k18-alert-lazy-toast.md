---
"@aceshooting/lyra-ui": patch
---
lr-alert: registering `lr-alert` no longer pulls in the toast stack; `alert.toast()` loads `lr-toast` on its first call when the page has not registered it.
