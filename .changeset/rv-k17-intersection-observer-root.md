---
"@aceshooting/lyra-ui": patch
---
lr-intersection-observer: `root="id"` now resolves inside the host's shadow tree before the document, so a wrapper in a shadow-DOM app observes against its scroller instead of the viewport.
