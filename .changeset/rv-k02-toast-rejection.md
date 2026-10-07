---
"@aceshooting/lyra-ui": patch
---
toast(): a failed lazy load no longer surfaces as an unhandled promise rejection for fire-and-forget callers; awaiting `item` still rejects.
