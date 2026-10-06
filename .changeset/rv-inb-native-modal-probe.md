---
"@aceshooting/lyra-ui": patch
---
Components that acquire announcement regions on connect, announce, or route Escape and Tab no longer each re-scan the document and force layout to find the active native modal: a burst of callers in the same script shares one answer, which is recomputed as soon as focus moves or a library modal opens or closes.
