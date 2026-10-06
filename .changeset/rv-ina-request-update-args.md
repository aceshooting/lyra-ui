---
"@aceshooting/lyra-ui": patch
---
Subclasses of Lyra components compiled with standard (TC39) decorators now update when a decorated private `accessor` or setter changes: the shared base class forwarded only the first three `requestUpdate()` arguments, so Lit compared the old value with an unreadable `undefined` and skipped the update.
