---
"@aceshooting/lyra-ui": patch
---

Raise the optional `pdfjs-dist` peer range to `^6.2.108` (from `^6.1.200`), alongside routine
development-dependency upgrades. Only consumers of `<lr-pdf-viewer>` are affected, and only if they
pin `pdfjs-dist` below `6.2.108`.
