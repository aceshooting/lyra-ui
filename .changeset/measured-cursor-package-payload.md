---
'@aceshooting/lyra-ui': patch
---

Update the UI unpacked ceiling and the translation and IDE byte ceilings for cursor navigation, ingestion actions, feedback policies, quantity formatting, localized labels and generated API data. The final ownership guard adds 65 unpacked UI bytes; each exceeded ceiling advances only to the next 64-byte boundary, preserving download limits, file-count reserves and the historical 25% reduction requirement.
