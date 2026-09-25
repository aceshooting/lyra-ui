---
'@aceshooting/lyra-ui': patch
---

`adaptAiSdkMessage()` maps the AI SDK `output-denied` state, and `approval-responded` with a rejected approval, to tool status `denied` instead of `running`.
