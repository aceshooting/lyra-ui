---
'@aceshooting/lyra-ui': patch
---

Observe custom graph renderer scheduler failures even when the scheduler synchronously cancels admission. Immediate and delayed failures from canceled work no longer escape as unhandled promise rejections.
