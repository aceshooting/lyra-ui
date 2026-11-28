---
"@aceshooting/lyra-ui": patch
---
Media sources and fetched resources now accept absolute URLs on the page's own custom-scheme origin (such as `app://host/assets/x.svg` in a desktop shell), so `lr-image`, `lr-avatar`, `lr-flag` and other resource-loading components render there; other origins, links and downloads, and `javascript:`/`vbscript:`/`file:`/`about:` URLs stay refused.
