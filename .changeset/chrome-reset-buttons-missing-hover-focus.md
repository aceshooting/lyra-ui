---
"@aceshooting/lyra-ui": patch
---

Fix four components (`lr-chunk-inspector`, `lr-community-card`, `lr-provenance-panel`,
`lr-notebook-viewer`) whose real `<button>`s get UA-chrome reset (`border:none; background:
transparent; cursor:pointer;`) but no hover or focus-visible of their own -- `lr-provenance-panel`'s
disclosure header (`aria-expanded`/`aria-controls`) had zero visible keyboard focus indicator at all.
