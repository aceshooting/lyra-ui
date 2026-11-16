---
'@aceshooting/lyra-ui': patch
---

Report active DOCX and PPTX transport failures even when they use an AbortError, while keeping canceled requests silent. Resume pending transport after same-task DOM moves without restarting active document conversions or presentation renderers, and discard late responses from retired requests.
