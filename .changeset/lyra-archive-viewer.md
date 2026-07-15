---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-archive-viewer>` for listing names and human-readable sizes inside `.zip` archives via
the optional `jszip` peer. It registers standard ZIP MIME types and a `.zip` filename fallback with
`<lyra-document-viewer>`; other archive formats remain on the generic download fallback.
