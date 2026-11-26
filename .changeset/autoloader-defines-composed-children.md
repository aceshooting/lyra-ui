---
"@aceshooting/lyra-ui": patch
---

The autoloader defines the children a tag composes before the tag itself, the same set the tag's granular `lr-<tag>.js` entry registers. Composites such as `<lr-copy-button>`, which reach into their `<lr-icon-button>` during their first update, no longer throw when loaded through `autoloader.js` or the CDN build. A child whose import fails is left to ordinary discovery, which reports and retries it once the host renders it.
