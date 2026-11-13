---
'@aceshooting/lyra-ui': patch
---

Apply and restore theme scopes in standalone SVG and XML documents. Color probes use the HTML namespace in their owning document, and elements without inline CSS support retain scoped attributes without attempting to paint tokens.
