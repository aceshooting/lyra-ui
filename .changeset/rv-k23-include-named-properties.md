---
"@aceshooting/lyra-ui": patch
---
lr-include: included markup no longer keeps `name` attributes, so a partial containing `<img name="config">` can no longer shadow `window.config` or `document.config` in the host page.
