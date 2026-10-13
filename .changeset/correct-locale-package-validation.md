---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-translations': patch
---

Correct pseudo-locale manifest imports to point to their Lyra UI exports. Allow valid regional catalog imports within the translations package while continuing to reject imports that escape the package.
